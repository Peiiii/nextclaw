import { loadConfig, saveConfig } from "@nextclaw/core";
import { McpDoctorFacade, McpMutationService, type McpMarketplaceInstallTemplate } from "@nextclaw/mcp";

export class ServiceMcpMarketplaceOps {
  constructor(
    private readonly options: {
      applyLiveConfigReload?: () => Promise<void>;
    }
  ) {}

  async install(params: {
    spec: string;
    name?: string;
    enabled?: boolean;
    allAgents?: boolean;
    agents?: string[];
    inputs?: Record<string, string>;
    template?: unknown;
  }): Promise<{ name: string; message: string; output?: string }> {
    if (!params.template) {
      throw new Error(`Missing MCP marketplace template for ${params.spec}`);
    }

    const template = params.template as McpMarketplaceInstallTemplate;
    const result = this.createMutationService().installFromTemplate({
      template,
      name: params.name,
      enabled: params.enabled,
      scope: {
        allAgents: params.allAgents ?? true,
        agents: params.allAgents === false ? params.agents ?? [] : []
      },
      inputs: params.inputs,
      metadata: {
        source: "marketplace",
        catalogSlug: params.spec,
        displayName: template.defaultName
      }
    });
    if (!result.changed) {
      throw new Error(result.message);
    }
    await this.options.applyLiveConfigReload?.();
    return {
      name: result.name,
      message: result.message
    };
  }

  async enable(name: string): Promise<{ message: string; output?: string }> {
    const result = this.createMutationService().toggleEnabled(name, true);
    if (!result.changed) {
      throw new Error(result.message);
    }
    await this.options.applyLiveConfigReload?.();
    return { message: result.message };
  }

  async disable(name: string): Promise<{ message: string; output?: string }> {
    const result = this.createMutationService().toggleEnabled(name, false);
    if (!result.changed) {
      throw new Error(result.message);
    }
    await this.options.applyLiveConfigReload?.();
    return { message: result.message };
  }

  async remove(name: string): Promise<{ message: string; output?: string }> {
    const result = this.createMutationService().removeServer(name);
    if (!result.changed) {
      throw new Error(result.message);
    }
    await this.options.applyLiveConfigReload?.();
    return { message: result.message };
  }

  async doctor(name: string) {
    const report = await this.createDoctorFacade().inspectOne(name);
    if (!report) {
      throw new Error(`Unknown MCP server: ${name}`);
    }
    return report;
  }

  private createMutationService(): McpMutationService {
    return new McpMutationService({
      getConfig: () => loadConfig(),
      saveConfig: (config) => saveConfig(config)
    });
  }

  private createDoctorFacade(): McpDoctorFacade {
    return new McpDoctorFacade({
      getConfig: () => loadConfig()
    });
  }
}
