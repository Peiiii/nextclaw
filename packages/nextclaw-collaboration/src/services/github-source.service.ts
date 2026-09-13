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

type Issue = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  updated_at: string;
  created_at: string;
  user: { login: string };
  labels: Array<{ name: string }>;
  pull_request?: unknown;
};
type Comment = {
  id: number;
  body: string;
  user: { login: string };
  created_at: string;
  updated_at: string;
};
export class GitHubSource implements SourceAdapter {
  readonly id = "github";
  private readonly repository: string;
  private readonly hostname: string;
  private checked?: { at: number; value: SourceCheck };
  constructor(private readonly connection: Connection) {
    this.repository = connection.options.repository;
    this.hostname = connection.options.hostname || "github.com";
    if (!/^[\w.-]+\/[\w.-]+$/.test(this.repository))
      throw new Error("GitHub repository must be owner/repo");
  }
  check = async (): Promise<SourceCheck> => {
    if (this.checked && Date.now() - this.checked.at < 15000)
      return this.checked.value;
    const user = await this.api<{
      login: string;
    }>("user");
    const repo = await this.api<{
      permissions?: {
        push?: boolean;
      };
    }>(`repos/${this.repository}`);
    const value = {
      source: `https://${this.hostname}/${this.repository.toLowerCase()}`,
      account: user.login,
      writable: !!repo.permissions?.push,
      editableStatus: true,
    };
    this.checked = { at: Date.now(), value };
    return value;
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
      `repos/${this.repository}/issues?state=all&sort=updated&direction=asc&since=${encodeURIComponent(after)}`,
    );
    const events: CollaborationEvent[] = [];
    for (const issue of issues) {
      if (issue.pull_request) continue;
      const invited = issue.labels.some(
        (label) =>
          label.name === (this.connection.options.label || "agent:mozhao"),
      );
      if (!invited && !subjects.includes(String(issue.number))) continue;
      events.push(
        this.event(
          issue,
          `issue:${issue.number}:${issue.updated_at}`,
          String(issue.number),
          issue.body || "",
          issue.user.login,
          issue.updated_at,
          issue.state === "closed" ? "closed" : "context",
          invited,
        ),
      );
      const comments = await this.pages<Comment>(
        `repos/${this.repository}/issues/${issue.number}/comments`,
      );
      for (const comment of comments) {
        if (comment.updated_at < since) continue;
        events.push(
          this.event(
            issue,
            `comment:${comment.id}:${comment.updated_at}`,
            String(comment.id),
            comment.body,
            comment.user.login,
            comment.updated_at,
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
    this.subject(subject);
    const issue = await this.api<Issue>(
      `repos/${this.repository}/issues/${subject}`,
    );
    const comments = await this.pages<Comment>(
      `repos/${this.repository}/issues/${subject}/comments`,
    );
    return {
      subject,
      title: issue.title,
      url: issue.html_url,
      body: issue.body || "",
      closed: issue.state === "closed",
      invited: issue.labels.some(
        (label) =>
          label.name === (this.connection.options.label || "agent:mozhao"),
      ),
      messages: comments.map((c) => ({
        id: String(c.id),
        body: c.body,
        account: c.user.login,
      })),
    };
  };
  reply = async (operation: OutputOperation): Promise<string> => {
    this.subject(operation.subject);
    const path = operation.existingId
      ? `repos/${this.repository}/issues/comments/${this.subject(operation.existingId)}`
      : `repos/${this.repository}/issues/${operation.subject}/comments`;
    const result = await this.api<{
      id: number;
    }>(path, operation.existingId ? "PATCH" : "POST", { body: operation.body });
    return String(result.id);
  };
  findReply = async (
    subject: string,
    operationId: string,
  ): Promise<string | undefined> => {
    return (await this.readContext(subject)).messages.find((message) =>
      isOwnOperation(
        this.connection,
        subject,
        message.body,
        message.account,
        operationId,
      ),
    )?.id;
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
      subject: String(issue.number),
      type: `github.${change}`,
      id,
      time,
      data: { resourceId, body, actor: { account }, change, invited },
    };
  };
  private subject = (id: string): string => {
    if (!/^\d+$/.test(id)) throw new Error("Invalid GitHub object ID");
    return id;
  };
  private api = <T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> => {
    return (method === "GET" ? readJson<T> : executeJson<T>)(
      [
        this.connection.options.executable || "gh",
        "api",
        "--hostname",
        this.hostname,
        "--method",
        method,
        path,
        ...(body === undefined ? [] : ["--input", "-"]),
      ],
      body === undefined ? undefined : JSON.stringify(body),
    );
  };
  private pages = async <T>(path: string): Promise<T[]> => {
    const items: T[] = [];
    for (let page = 1; page <= 100; page++) {
      const batch = await this.api<T[]>(
        `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
      );
      items.push(...batch);
      if (batch.length < 100) return items;
    }
    throw new Error("GitHub pagination exceeds 10000 objects; narrow scope");
  };
}
