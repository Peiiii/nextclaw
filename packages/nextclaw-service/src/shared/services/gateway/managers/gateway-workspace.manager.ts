import {
  getWorkspacePath,
  type Config,
} from "@nextclaw/core";

export class GatewayWorkspaceManager {
  readonly workspace: string;
  readonly initializeAgentHomeDirectory: (homeDirectory: string) => void;

  constructor(params: {
    config: Config;
    initializeAgentHomeDirectory: (homeDirectory: string) => void;
  }) {
    this.workspace = getWorkspacePath(params.config.agents.defaults.workspace);
    this.initializeAgentHomeDirectory = params.initializeAgentHomeDirectory;
  }
}
