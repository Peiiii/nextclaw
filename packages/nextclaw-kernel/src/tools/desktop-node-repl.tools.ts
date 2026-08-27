import type { DesktopNodeReplService } from "@kernel/features/desktop-host/index.js";
import { normalizeToolParams } from "@nextclaw/core";
import type { NcpTool, NcpToolExecutionContext } from "@nextclaw/ncp";

export type DesktopNodeReplToolContext = {
  agentId: string;
  sessionId: string;
  agentRunId?: string;
};

class DesktopNodeReplTool implements NcpTool {
  readonly name = "node_repl";
  readonly description =
    "Execute a short JavaScript snippet in a session-scoped, restricted REPL. The only injected capability is `desktop`: `await desktop.getAppState({ target: { applicationId: 'wechat' }, source?: 'accessibility' | 'screen' | 'both' })`, `await desktop.setValue({ target, stateId, element: { index }, value })`, `await desktop.click({ target, stateId, element: { index } })`, `await desktop.typeText({ target, stateId, text })`, and `await desktop.pressKey({ target, stateId, key, modifiers?: ['command' | 'control' | 'option' | 'shift'] })`. Key is a lowercase letter/digit or one of Enter, Escape, Tab, Space, Backspace, Delete, ArrowUp, ArrowDown, ArrowLeft, ArrowRight. Registered application IDs are `wechat`, `finder`, `textedit`, `activity_monitor`, `system_settings`, and `chrome`; always use these IDs, never an app display name or bundle ID. If accessibility is incomplete, first read `source: 'both'`, then use `await desktop.click({ target, stateId, coordinate: { x, y } })` with screenshot-pixel coordinates (top-left origin), only inside that captured image. `typeText` and `pressKey` require a fresh screen state; text is typed literally, including line breaks. Use `repl.write(value)` to return intermediate output. There is no process, require, import, filesystem, terminal, network, environment, or arbitrary package access. Desktop actions remain grant- and state-checked; the SDK does not decide whether an interaction is a message send or form submission based on button text.";
  readonly parameters: NcpTool["parameters"] = {
    type: "object",
    properties: { code: { type: "string", minLength: 1, maxLength: 32_768 } },
    required: ["code"],
    additionalProperties: false,
  };

  constructor(
    private readonly service: DesktopNodeReplService,
    private readonly context: DesktopNodeReplToolContext,
  ) {}

  execute = async (args: unknown, context?: NcpToolExecutionContext): Promise<unknown> => {
    const params = normalizeToolParams(args);
    return await this.service.execute({ ...this.context, code: params.code, ...(context?.abortSignal ? { signal: context.abortSignal } : {}) });
  };
}

export function createDesktopNodeReplTool(
  service: DesktopNodeReplService,
  context: DesktopNodeReplToolContext,
): NcpTool {
  return new DesktopNodeReplTool(service, context);
}
