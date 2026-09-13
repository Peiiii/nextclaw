import type {
  CollaborationEvent,
  Connection,
  Conversation,
  OutputOperation,
  SourceAdapter,
  SourceBatch,
  SourceCheck,
} from "../types/collaboration.types.js";
import { executeJson, readJson } from "../utils/process.utils.js";
import { isOwnOperation } from "../utils/identity.utils.js";

type Page<T> = {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string };
};
type Issue = {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string;
  updatedAt: string;
  creator: { id: string } | null;
  state: { type: string };
  labels: { nodes: Array<{ name: string }> };
};
type Comment = {
  id: string;
  body: string;
  updatedAt: string;
  user: { id: string } | null;
};
const issueFields =
  "id identifier title description url updatedAt creator { id } state { type } labels { nodes { name } }";
export class LinearSource implements SourceAdapter {
  readonly id = "linear";
  private checked?: { at: number; value: SourceCheck };
  constructor(private readonly connection: Connection) {}
  check = async (): Promise<SourceCheck> => {
    if (this.checked && Date.now() - this.checked.at < 15000)
      return this.checked.value;
    const value = await this.api<{
      viewer: {
        id: string;
      };
      organization: {
        id: string;
      };
    }>("query { viewer { id } organization { id } }");
    const check = {
      source: `urn:linear:${value.organization.id}:${this.connection.options.team}`,
      account: value.viewer.id,
      writable: true,
      editableStatus: true,
    };
    this.checked = { at: Date.now(), value: check };
    return check;
  };
  collect = async (
    checkpoint: string | undefined,
    since: string,
    subjects: string[],
  ): Promise<SourceBatch> => {
    const started = new Date().toISOString();
    const after = new Date(
      Math.max(Date.parse(since), Date.parse(checkpoint || since) - 60000),
    ).toISOString();
    const issues = await this.pages<Issue>(
      `query($cursor:String,$team:String!,$since:DateTimeOrDuration!){ issues(first:100,after:$cursor,filter:{team:{key:{eq:$team}},updatedAt:{gte:$since}}){nodes{${issueFields}} pageInfo{hasNextPage endCursor}}}`,
      "issues",
      { team: this.connection.options.team, since: after },
    );
    const events: CollaborationEvent[] = [];
    for (const issue of issues) {
      const invited = issue.labels.nodes.some(
        (label) =>
          label.name === (this.connection.options.label || "agent:mozhao"),
      );
      if (!invited && !subjects.includes(issue.id)) continue;
      events.push(
        this.event(
          issue,
          `issue:${issue.id}:${issue.updatedAt}`,
          issue.id,
          issue.description || "",
          issue.creator?.id || "",
          issue.updatedAt,
          ["completed", "canceled"].includes(issue.state.type)
            ? "closed"
            : "context",
          invited,
        ),
      );
      for (const comment of await this.comments(issue.id)) {
        if (comment.updatedAt < since) continue;
        events.push(
          this.event(
            issue,
            `comment:${comment.id}:${comment.updatedAt}`,
            comment.id,
            comment.body,
            comment.user?.id || "",
            comment.updatedAt,
            "message",
            invited,
          ),
        );
      }
    }
    return {
      events: events.sort((a, b) => a.time.localeCompare(b.time)),
      checkpoint: started,
    };
  };
  readContext = async (subject: string): Promise<Conversation> => {
    const { issue } = await this.api<{
      issue: Issue;
    }>(`query($id:String!){issue(id:$id){${issueFields}}}`, { id: subject });
    return {
      subject: issue.id,
      title: `${issue.identifier} ${issue.title}`,
      url: issue.url,
      body: issue.description || "",
      closed: ["completed", "canceled"].includes(issue.state.type),
      invited: issue.labels.nodes.some(
        (l) => l.name === (this.connection.options.label || "agent:mozhao"),
      ),
      messages: (await this.comments(subject)).map((c) => ({
        id: c.id,
        body: c.body,
        account: c.user?.id || "",
      })),
    };
  };
  reply = async (operation: OutputOperation): Promise<string> => {
    if (operation.existingId) {
      const result = await this.api<{
        commentUpdate: {
          success: boolean;
          comment: {
            id: string;
          };
        };
      }>(
        "mutation($id:String!,$body:String!){commentUpdate(id:$id,input:{body:$body}){success comment{id}}}",
        { id: operation.existingId, body: operation.body },
      );
      if (!result.commentUpdate.success)
        throw new Error("Linear comment update rejected");
      return result.commentUpdate.comment.id;
    }
    const result = await this.api<{
      commentCreate: {
        success: boolean;
        comment: {
          id: string;
        };
      };
    }>(
      "mutation($issue:String!,$body:String!){commentCreate(input:{issueId:$issue,body:$body}){success comment{id}}}",
      { issue: operation.subject, body: operation.body },
    );
    if (!result.commentCreate.success)
      throw new Error("Linear comment create rejected");
    return result.commentCreate.comment.id;
  };
  findReply = async (
    subject: string,
    operationId: string,
  ): Promise<string | undefined> => {
    return (await this.comments(subject)).find((c) =>
      isOwnOperation(
        this.connection,
        subject,
        c.body,
        c.user?.id || "",
        operationId,
      ),
    )?.id;
  };
  private comments = async (id: string): Promise<Comment[]> => {
    return this.pages<Comment>(
      "query($id:String!,$cursor:String){issue(id:$id){comments(first:100,after:$cursor){nodes{id body updatedAt user{id}} pageInfo{hasNextPage endCursor}}}}",
      "issue.comments",
      { id },
    );
  };
  private event = (
    issue: Issue,
    id: string,
    resourceId: string,
    body: string,
    account: string,
    time: string,
    change: CollaborationEvent["data"]["change"],
    invited: boolean,
  ): CollaborationEvent => {
    return {
      specversion: "1.0",
      source: this.connection.source,
      subject: issue.id,
      type: `linear.${change}`,
      id,
      time,
      data: { resourceId, body, actor: { account }, change, invited },
    };
  };
  private api = async <T>(
    query: string,
    variables: unknown = {},
  ): Promise<T> => {
    const run = query.trim().startsWith("query")
      ? readJson<{
          data: T;
          errors?: unknown[];
        }>
      : executeJson<{
          data: T;
          errors?: unknown[];
        }>;
    const result = await run([
      this.connection.options.executable || "linear",
      ...(this.connection.options.workspace
        ? ["--workspace", this.connection.options.workspace]
        : []),
      "api",
      query,
      "--variables-json",
      JSON.stringify(variables),
    ]);
    if (result.errors?.length || !result.data)
      throw new Error("Linear GraphQL request failed");
    return result.data;
  };
  private pages = async <T>(
    query: string,
    path: string,
    variables: Record<string, unknown>,
  ): Promise<T[]> => {
    const items: T[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 100; page++) {
      const result = await this.api<Record<string, unknown>>(query, {
        ...variables,
        cursor,
      });
      const data = path
        .split(".")
        .reduce<unknown>(
          (value, key) => (value as Record<string, unknown>)[key],
          result,
        ) as Page<T>;
      items.push(...data.nodes);
      if (!data.pageInfo.hasNextPage) return items;
      cursor = data.pageInfo.endCursor;
    }
    throw new Error("Linear pagination exceeds 10000 objects; narrow scope");
  };
}
