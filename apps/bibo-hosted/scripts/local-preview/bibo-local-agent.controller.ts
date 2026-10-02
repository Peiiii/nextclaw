import { join } from "node:path";
import { homedir } from "node:os";
import type { ServerResponse } from "node:http";
import { Contribution, NextclawHarness, type NcpTool } from "@nextclaw/harness";
import { NodePlatform, createShowContentTools } from "@nextclaw/kernel";
import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import type { BiboShowContent } from "@nextclaw/bibo-client";
import type { BiboSpaceService } from "../../src/features/bibo-domain/services/bibo-space.service";
import { createBiboSpaceTool } from "../../src/features/bibo-domain/tools/bibo-space.tools";
import { projectBiboConversation, projectBiboRunContent } from "../../src/app/utils/bibo-session.utils";

class LocalSpaceContribution extends Contribution {
  constructor(private readonly scopes: Map<string, NcpTool[]>) { super({ id: "bibo-local-preview" }); }
  protected setup = (): void => {
    this.effect(() => this.kernel.tools.registerProvider({ provide: ({ sessionId }) => sessionId ? this.scopes.get(sessionId) ?? [] : [] }));
    this.effect(() => this.kernel.context.register({ provide: () => ["You are Bibo, the user's personal AI companion. Reply in the user's language. Use bibo to save and manage their notes, files, tasks and events. After saving a document, call show_file and cite its returned uri. Only use bibo, show_file and request_user_input_async in this local preview."] }));
  };
}

/** Development host for the same public Harness and Bibo domain tools, without hosted trial quotas. */
export class BiboLocalAgentController {
  private readonly harness: NextclawHarness;
  private readonly scopes = new Map<string, NcpTool[]>();
  private readonly created = new Set<string>();
  constructor(private readonly home: string, private readonly space: BiboSpaceService) {
    this.harness = new NextclawHarness({ platform: new NodePlatform({ homeDir: join(home, "agent"),
      configPath: process.env.BIBO_UI_CONFIG ?? join(homedir(), ".nextclaw", "config.json"), sessionSearchEnabled: false, sessionTitleEnabled: false }), allowSlashCommands: false });
    this.harness.contributions.register(new LocalSpaceContribution(this.scopes));
  }
  dispose = (): Promise<void> => this.harness.dispose();
  stream = async (input: { sessionId: string; message: string; signal: AbortSignal; question?: { id: string; action: "answer" | "dismiss" } },
    response: ServerResponse, committed: (result: Awaited<ReturnType<BiboLocalAgentController["run"]>>) => unknown): Promise<void> => {
    const send = (name: string, value: unknown) => { if (!input.signal.aborted) response.write(`event: ${name}\ndata: ${JSON.stringify(value)}\n\n`); };
    try {
      const result = await this.run(input.sessionId, input.message, input.signal, (text, blockId) => send("delta", { text, blockId }), input.question);
      if (input.signal.aborted) return;
      send("saving", {});
      const session = committed(result);
      for (const display of result.displayEvents) send("show-content", display);
      send("committed", { messages: result.messages, text: result.text, session });
    } catch { send("error", { error: "本地模型调用失败，请检查模型连接后重试。" }); }
    finally { response.end(); }
  };
  remove = async (sessionId: string): Promise<void> => { await this.harness.start(); await this.harness.sessions.delete(sessionId); this.created.delete(sessionId); };
  run = async (sessionId: string, input: string, signal: AbortSignal,
    delta: (text: string, blockId: string) => void, question?: { id: string; action: "answer" | "dismiss" }) => {
    await this.harness.start();
    if (!this.created.has(sessionId)) {
      await this.harness.agents.get().sessions.create({ sessionId, task: input, workspace: join(this.home, "workspace"), model: process.env.BIBO_UI_MODEL });
      this.created.add(sessionId);
    }
    const displayEvents: BiboShowContent[] = [];
    const show = createShowContentTools({ emit: (_key: unknown, value: Omit<BiboShowContent, "sessionId">) => {
      if (value.target.type === "file") displayEvents.push({ ...value, sessionId });
    } } as Parameters<typeof createShowContentTools>[0], undefined, true);
    this.scopes.set(sessionId, [createBiboSpaceTool(this.space, sessionId, true), ...show]);
    const before = await this.harness.listSessionMessages(sessionId);
    let block = 0;
    const callbacks = { sessionId, signal, onEvent: (event: NcpEndpointEvent) => {
      if (event.type === NcpEventType.MessageTextStart) block += 1;
      if (event.type === NcpEventType.MessageTextDelta) delta(event.payload.delta, `${event.payload.messageId}:${block}`);
    } };
    try {
      if (question) await this.harness.answerUserQuestion({ ...callbacks, questionId: question.id, action: question.action, answer: input });
      else await this.harness.runTask({ ...callbacks, input, model: process.env.BIBO_UI_MODEL });
      const after = await this.harness.listSessionMessages(sessionId);
      return { ...projectBiboRunContent(before, after), messages: projectBiboConversation(after), displayEvents };
    } finally { this.scopes.delete(sessionId); }
  };
}
