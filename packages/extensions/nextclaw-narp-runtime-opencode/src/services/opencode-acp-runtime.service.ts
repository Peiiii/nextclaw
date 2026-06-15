import type {
  NcpAgentRunInput,
  NcpAgentRunOptions,
  NcpAgentRuntime,
  NcpEndpointEvent,
} from "@nextclaw/ncp";
import { StdioRuntimeNcpAgentRuntime } from "@nextclaw/nextclaw-ncp-runtime-stdio-client";
import type { OpencodeAcpRuntimeConfig } from "@opencode-narp/types/opencode-narp-runtime.types.js";

export class OpencodeAcpRuntime implements NcpAgentRuntime {
  private readonly runtime: StdioRuntimeNcpAgentRuntime;

  constructor(private readonly config: OpencodeAcpRuntimeConfig) {
    this.runtime = new StdioRuntimeNcpAgentRuntime({
      wireDialect: "acp",
      processScope: "per-session",
      command: config.command,
      args: config.args,
      cwd: config.cwd,
      env: config.env,
      startupTimeoutMs: config.startupTimeoutMs,
      probeTimeoutMs: config.startupTimeoutMs,
      requestTimeoutMs: config.requestTimeoutMs,
      resolveProviderRoute: () => this.config.providerRoute,
    });
  }

  run = async function* (
    this: OpencodeAcpRuntime,
    input: NcpAgentRunInput,
    options?: NcpAgentRunOptions,
  ): AsyncGenerator<NcpEndpointEvent> {
    yield* this.runtime.run(input, options);
  };

  dispose = async (): Promise<void> => {
    await this.runtime.dispose();
  };
}
