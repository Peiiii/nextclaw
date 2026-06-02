import type { NcpAgentRuntime } from "@nextclaw/ncp";
import {
  NarpStdioRuntimeWrapper,
  type NarpStdioRuntimeWrapperContext,
} from "@nextclaw/nextclaw-narp-stdio-runtime-wrapper";
import { OpencodeAcpRuntime } from "./opencode-acp-runtime.service.js";
import { OpencodeRuntimeConfigService } from "./opencode-runtime-config.service.js";
import type { OpencodeAcpRuntimeConfig } from "@opencode-narp/types/opencode-narp-runtime.types.js";

export type OpencodeNarpRuntimeFactory = (
  config: OpencodeAcpRuntimeConfig,
) => NcpAgentRuntime;

export type OpencodeRuntimeConfigResolver = {
  resolve: (
    context: NarpStdioRuntimeWrapperContext,
  ) => Promise<OpencodeAcpRuntimeConfig>;
};

export class OpencodeNarpRuntimeWrapper {
  constructor(
    private readonly configService: OpencodeRuntimeConfigResolver = new OpencodeRuntimeConfigService(),
    private readonly createRuntime: OpencodeNarpRuntimeFactory = (
      config,
    ) => new OpencodeAcpRuntime(config),
  ) {}

  start = (): void => {
    new NarpStdioRuntimeWrapper({
      agentName: "NextClaw OpenCode NARP",
      createRuntime: (context) => this.createOpencodeRuntime(context),
    }).start();
  };

  createOpencodeRuntime = async (
    context: NarpStdioRuntimeWrapperContext,
  ): Promise<NcpAgentRuntime> => this.createRuntime(await this.configService.resolve(context));
}
