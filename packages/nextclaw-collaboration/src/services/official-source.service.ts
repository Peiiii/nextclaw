import { readFile } from "node:fs/promises";
import { EnvHttpProxyAgent, fetch } from "undici";
import type {
  CollaborationEvent,
  Connection,
  Conversation,
  OutputOperation,
  SourceAdapter,
  SourceBatch,
  SourceCheck,
} from "../types/collaboration.types.js";
import { digest, isOwnOperation } from "../utils/identity.utils.js";
type View = {
  thread: {
    id: string;
    title: string;
    space: string;
    openedBy: { id: string };
    createdAt: string;
  };
  posts: Array<{
    id: string;
    body: string;
    author: { id: string };
    createdAt: string;
  }>;
};
export class OfficialSource implements SourceAdapter {
  private readonly dispatcher = new EnvHttpProxyAgent();
  readonly id = "official";
  readonly maxMessageChars = 4000;
  constructor(private readonly connection: Connection) {
    const url = new URL(connection.options.endpoint);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      throw new Error("Official endpoint must use HTTPS");
  }
  check = async (): Promise<SourceCheck> => {
    await this.request("/api/discussions/participant?space=direct");
    return {
      source: new URL(this.connection.options.endpoint).origin,
      account: "nextclaw-discussion-participant",
      writable: true,
      editableStatus: false,
    };
  };
  collect = async (
    checkpoint: string | undefined,
    since: string,
    subjects: string[] = [],
  ): Promise<SourceBatch> => {
    const page = await this.request<{
      items: Array<{
        cursor: number;
        threadId: string;
        postId: string | null;
        type: string;
        createdAt: string;
      }>;
      nextCursor: number;
    }>(`/api/discussions/participant/events?after=${Number(checkpoint || 0)}`);
    const events: CollaborationEvent[] = [];
    for (const event of page.items) {
      if (event.createdAt < since) continue;
      const view = await this.view(event.threadId);
      if (
        view.thread.space === "support" &&
        !(await this.approved(event.threadId))
      )
        continue;
      const post =
        view.posts.find((p) => p.id === event.postId) ||
        (event.type === "thread-updated"
          ? view.posts
              .filter((p) => p.author.id !== "nextclaw-discussion-participant")
              .at(-1)
          : undefined);
      events.push({
        specversion: "1.0",
        source: this.connection.source,
        subject: event.threadId,
        id: post ? `official-post:${post.id}` : `official:${event.cursor}`,
        type: event.type,
        time: event.createdAt,
        data: {
          resourceId: post?.id || event.threadId,
          body: post?.body || view.posts[0]?.body || view.thread.title,
          actor: { account: post?.author.id || view.thread.openedBy.id },
          change: post ? "message" : "context",
          invited: true,
        },
      });
    }
    // The legacy event stream targets the opposite role, so participant-to-participant
    // messages must be collected from already-followed conversations as well.
    for (const subject of subjects) {
      const view = await this.view(subject);
      if (view.thread.space === "support" && !(await this.approved(subject)))
        continue;
      for (const post of view.posts) {
        if (
          post.createdAt < since ||
          !post.body.includes("<!-- nextclaw-collaboration:")
        )
          continue;
        events.push({
          specversion: "1.0",
          source: this.connection.source,
          subject,
          id: `official-post:${post.id}`,
          type: "official.signed-message",
          time: post.createdAt,
          data: {
            resourceId: post.id,
            body: post.body,
            actor: { account: post.author.id },
            change: "message",
            invited: true,
          },
        });
      }
    }
    return { events, checkpoint: String(page.nextCursor) };
  };
  readContext = async (subject: string): Promise<Conversation> => {
    const view = await this.view(subject);
    if (view.thread.space === "support" && !(await this.approved(subject)))
      throw new Error("Support input is awaiting administrator approval");
    return {
      subject,
      instructions:
        view.thread.space === "support"
          ? "本来源是 NextClaw support 工作流。先用 nextclaw feedback workflow get 读取此 ID 的最新审批；修复前必须 claim，执行中遵守审批 inputVersion、authority 与平台暂停/撤销。结果通过 feedback workflow result 等业务命令登记；讨论回复不能替代审批、验证或发布证明。不要用 discussion post 或 workflow comment 重复发送最终回复，宿主负责回写。未取得必要工作流权限时停止并说明原因。"
          : undefined,
      title: view.thread.title,
      url: `${this.connection.options.endpoint}/?discussion=${encodeURIComponent(subject)}`,
      body: view.posts[0]?.body || "",
      closed: false,
      invited: true,
      messages: view.posts.map((p) => ({
        id: p.id,
        body: p.body,
        account: p.author.id,
      })),
    };
  };
  reply = async (operation: OutputOperation): Promise<string> => {
    const view = await this.request<View>(
      `/api/discussions/participant/${encodeURIComponent(operation.subject)}/posts`,
      { operationId: digest(operation.id), body: operation.body },
    );
    const post = view.posts.find((p) =>
      isOwnOperation(
        this.connection,
        operation.subject,
        p.body,
        p.author.id,
        operation.id,
      ),
    );
    if (!post)
      throw new Error("Official reply accepted without matching output record");
    return post.id;
  };
  findReply = async (
    subject: string,
    operationId: string,
  ): Promise<string | undefined> => {
    return (await this.view(subject)).posts.find((p) =>
      isOwnOperation(
        this.connection,
        subject,
        p.body,
        p.author.id,
        operationId,
      ),
    )?.id;
  };
  private view = (subject: string): Promise<View> => {
    return this.request(
      `/api/discussions/participant/${encodeURIComponent(subject)}`,
    );
  };
  private approved = async (subject: string): Promise<boolean> => {
    const report = await this.request<{
      inputVersion: number;
      approval?: {
        inputVersion: number;
      };
    }>(`/api/support/workflow/${encodeURIComponent(subject)}`);
    return report.approval?.inputVersion === report.inputVersion;
  };
  private request = async <T>(path: string, body?: unknown): Promise<T> => {
    const token = (
      await readFile(this.connection.options.tokenFile, "utf8")
    ).trim();
    const response = await fetch(
      new URL(path, this.connection.options.endpoint),
      {
        dispatcher: this.dispatcher,
        method: body ? "POST" : "GET",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    const result = (await response.json()) as {
      ok: boolean;
      data: T;
      error?: {
        message: string;
      };
    };
    if (!response.ok || !result.ok)
      throw new Error(
        result.error?.message || `Official source HTTP ${response.status}`,
      );
    return result.data;
  };
}
