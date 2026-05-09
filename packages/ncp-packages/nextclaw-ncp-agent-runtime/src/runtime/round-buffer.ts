import type { NcpRoundBuffer, NcpToolCallResult } from "@nextclaw/ncp";

export class DefaultNcpRoundBuffer implements NcpRoundBuffer {
  private text = "";
  private readonly toolCalls: NcpToolCallResult[] = [];
  private pending: { toolCallId: string; toolName: string; args: unknown } | null = null;

  appendText = (delta: string): void => {
    this.text += delta;
  };

  getText = (): string => {
    return this.text;
  };

  appendToolCall = (result: NcpToolCallResult): void => {
    this.toolCalls.push(result);
  };

  getToolCalls = (): ReadonlyArray<NcpToolCallResult> => {
    return [...this.toolCalls];
  };

  startToolCall = (toolCallId: string, toolName: string): void => {
    this.pending = { toolCallId, toolName, args: undefined };
  };

  appendToolCallArgs = (args: unknown): void => {
    if (this.pending) this.pending.args = args;
  };

  consumePendingToolCall = (): { toolCallId: string; toolName: string; args: unknown } | null => {
    const p = this.pending;
    this.pending = null;
    return p;
  };

  clear = (): void => {
    this.text = "";
    this.toolCalls.length = 0;
    this.pending = null;
  };
}
