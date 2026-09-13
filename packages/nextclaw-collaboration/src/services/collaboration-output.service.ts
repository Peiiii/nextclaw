import type {
  Connection,
  ContextState,
  OutboxEntry,
  SourceAdapter,
} from "../types/collaboration.types.js";
import type { CollaborationStore } from "../stores/collaboration.store.js";
import { digest, signMessage } from "../utils/identity.utils.js";

/** Owns durable platform output and the single editable status receipt. */
export class CollaborationOutputService {
  constructor(
    private readonly store: CollaborationStore,
    private readonly sources: Map<string, SourceAdapter>,
  ) {}
  publish = async (): Promise<void> => {
    for (const context of this.store.list<ContextState>("context")) {
      if (context.status === context.statusPublished) continue;
      if (
        this.store
          .list<OutboxEntry>("outbox")
          .some(
            (e) =>
              e.contextKey === context.key &&
              e.id.startsWith("status:") &&
              ["sending", "unknown"].includes(e.state),
          )
      )
        continue;
      try {
        const source = this.source(context.connectionId);
        if (!source.reply) {
          context.statusPublished = context.status;
          this.saveContext(context);
          continue;
        }
        const check = await source.check();
        if (!check.editableStatus && context.statusMessageId) continue;
        const body = `${context.status}\n\nAgent: ${context.agentId}${context.threadId ? `\nCodex 任务：\`${context.threadId}\`` : ""}\n控制：\`/agent status\` · \`/agent pause\` · \`/agent resume\` · \`/agent cancel\``;
        this.enqueue(
          context,
          `status:${context.key}:${context.statusVersion || 0}:${digest(body)}`,
          body,
          "status",
          0,
          context.statusMessageId,
        );
      } catch (error) {
        context.error = errorMessage(error);
        this.saveContext(context);
      }
    }
    const outputs = this.store
      .list<OutboxEntry>("outbox")
      .filter((e) => e.state === "pending" || e.state === "sending");
    outputs.sort(
      (a, b) =>
        Number(b.operation.purpose === "status") -
        Number(a.operation.purpose === "status"),
    );
    for (const entry of outputs) await this.deliver(entry);
  };
  enqueue = (
    context: ContextState,
    id: string,
    text: string,
    purpose: "reply" | "status",
    hop: number,
    existingId?: string,
  ): void => {
    if (this.store.get("outbox", id)) return;
    const { key, connectionId, source, subject, status } = context;
    const connection = this.store.get<Connection>("connection", connectionId)!;
    const scope = { source, subject, operationId: id, purpose, hop };
    let content = `🤖[墨爪] ${connection.agent.id}：${text}`;
    let body = signMessage(connection.agent, content, scope);
    const limit = this.source(connectionId).maxMessageChars || 60_000;
    if (body.length > limit) {
      const footer = `\n\n内容较长，完整结果见本地 show ${key}`;
      const available = limit - (body.length - content.length) - footer.length;
      if (available < 50)
        throw new Error("Source message limit cannot fit the signed envelope");
      content = content.slice(0, available) + footer;
      body = signMessage(connection.agent, content, scope);
    }
    this.store.put("outbox", id, {
      id,
      contextKey: key,
      state: "pending",
      statusValue: purpose === "status" ? status : undefined,
      operation: { id, subject: subject, body, purpose, existingId },
    } satisfies OutboxEntry);
  };
  private deliver = async (entry: OutboxEntry): Promise<void> => {
    const context = this.store.get<ContextState>("context", entry.contextKey)!;
    const source = this.source(context.connectionId);
    if (
      entry.state === "pending" &&
      entry.id.startsWith("status:") &&
      entry.statusValue !== context.status
    ) {
      entry.state = "superseded";
      this.store.put("outbox", entry.id, entry);
      return;
    }
    if (!source.reply) {
      entry.state = "sent";
      context.status = "处理完成（单向来源，结果见本地记录）";
      this.store.put("outbox", entry.id, entry);
      this.saveContext(context);
      return;
    }
    try {
      const connection = this.store.get<Connection>(
        "connection",
        context.connectionId,
      )!;
      const check = await source.check();
      if (
        check.source !== connection.source ||
        check.account !== connection.account ||
        !check.writable
      )
        throw new Error(
          "Output identity/permission changed; reconnect before replying",
        );
      await this.sendOutput(source, entry);
      if (entry.state === "sent" && entry.messageId) {
        context.error = undefined;
        entry.error = undefined;
        this.store.put(
          "own-output",
          `${context.connectionId}:${entry.messageId}`,
          { operationId: entry.id },
        );
        if (entry.operation.purpose === "reply")
          context.status = "已完成，结果已回复";
        else if (entry.id.startsWith("status:")) {
          context.statusMessageId = entry.messageId;
          context.statusPublished = entry.statusValue;
        }
      }
      if (entry.state === "unknown") context.status = "回复是否发送成功待核实";
    } catch (error) {
      entry.error = errorMessage(error);
    }
    this.store.put("outbox", entry.id, entry);
    this.saveContext(context);
  };
  private sendOutput = async (
    source: SourceAdapter,
    entry: OutboxEntry,
  ): Promise<void> => {
    if (entry.state === "sending") {
      const existing = await source.findReply?.(
        entry.operation.subject,
        entry.id,
      );
      if (existing) {
        entry.messageId = existing;
        entry.state = "sent";
        return;
      }
      if (!entry.operation.existingId) {
        entry.state = "unknown";
        entry.error =
          "Output delivery cannot be confirmed; inspect before retry";
        return;
      }
    }
    entry.state = "sending";
    this.store.put("outbox", entry.id, entry);
    entry.messageId = await source.reply!(entry.operation);
    entry.state = "sent";
  };
  private saveContext = (context: ContextState): void => {
    this.store.putContext(context);
  };
  private source = (id: string): SourceAdapter => {
    const source = this.sources.get(id);
    if (!source) throw new Error(`Source ${id} is not loaded`);
    return source;
  };
}
function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}
