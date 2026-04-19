import { getWorkspacePath, loadConfig } from "@nextclaw/core";
import type {
  MarketplaceInstallSkillParams,
  MarketplaceInstaller,
  MarketplaceMcpDoctorResult,
  MarketplaceMcpInstallRequest
} from "@nextclaw/server";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  disablePluginMutation,
  enablePluginMutation,
  installPluginMutation,
  uninstallPluginMutation
} from "@/cli/commands/plugin/plugin-mutation-actions.js";
import { buildMarketplaceSkillInstallArgs, pickUserFacingCommandSummary } from "@/cli/shared/utils/marketplace/service-marketplace-helpers.utils.js";
import { ServiceMcpMarketplaceOps } from "@/cli/shared/services/marketplace/service-mcp-marketplace-ops.js";

type UserFacingResult = {
  message: string;
  output?: string;
};

type BuiltinSkillInstallResult = UserFacingResult | null;

export class ServiceMarketplaceInstaller {
  constructor(
    private readonly deps: {
      applyLiveConfigReload?: () => Promise<void>;
      runCliSubcommand: (args: string[]) => Promise<string>;
      installBuiltinSkill: (slug: string, force?: boolean) => BuiltinSkillInstallResult;
    }
  ) {}

  createInstaller(): MarketplaceInstaller {
    return {
      installPlugin: (spec) => this.installPlugin(spec),
      installSkill: (params) => this.installSkill(params),
      installMcp: (params) => this.installMcp(params),
      enablePlugin: (id) => this.enablePlugin(id),
      disablePlugin: (id) => this.disablePlugin(id),
      uninstallPlugin: (id) => this.uninstallPlugin(id),
      uninstallSkill: (slug) => this.uninstallSkill(slug),
      enableMcp: (name) => this.enableMcp(name),
      disableMcp: (name) => this.disableMcp(name),
      removeMcp: (name) => this.removeMcp(name),
      doctorMcp: (name) => this.doctorMcp(name)
    };
  }

  private async installPlugin(spec: string): Promise<UserFacingResult> {
    const result = await installPluginMutation(spec);
    await this.deps.applyLiveConfigReload?.();
    return { message: result.message };
  }

  private async installSkill(params: MarketplaceInstallSkillParams): Promise<UserFacingResult> {
    if (params.kind === "builtin") {
      const result = this.deps.installBuiltinSkill(params.slug, params.force);
      if (!result) {
        throw new Error(`Builtin skill not found: ${params.slug}`);
      }
      return result;
    }

    if (params.kind && params.kind !== "marketplace") {
      throw new Error(`Unsupported marketplace skill kind: ${params.kind}`);
    }

    const workspace = getWorkspacePath(loadConfig().agents.defaults.workspace);
    const args = buildMarketplaceSkillInstallArgs({
      slug: params.slug,
      workspace,
      force: params.force
    });

    try {
      const output = await this.deps.runCliSubcommand(args);
      const summary = pickUserFacingCommandSummary(output, `Installed skill: ${params.slug}`);
      return { message: summary };
    } catch (error) {
      const fallback = this.deps.installBuiltinSkill(params.slug, params.force);
      if (!fallback) {
        throw error;
      }
      return fallback;
    }
  }

  private async installMcp(params: MarketplaceMcpInstallRequest): Promise<{ name: string; message: string; output?: string }> {
    return await this.createMcpMarketplaceOps().install(params);
  }

  private async enablePlugin(id: string): Promise<UserFacingResult> {
    const result = await enablePluginMutation(id);
    await this.deps.applyLiveConfigReload?.();
    return { message: result.message };
  }

  private async disablePlugin(id: string): Promise<UserFacingResult> {
    const result = await disablePluginMutation(id);
    await this.deps.applyLiveConfigReload?.();
    return { message: result.message };
  }

  private async uninstallPlugin(id: string): Promise<UserFacingResult> {
    await disablePluginMutation(id);
    await this.deps.applyLiveConfigReload?.();
    const result = await uninstallPluginMutation(id, { force: true });
    await this.deps.applyLiveConfigReload?.();
    return { message: result.message };
  }

  private async uninstallSkill(slug: string): Promise<UserFacingResult> {
    const workspace = getWorkspacePath(loadConfig().agents.defaults.workspace);
    const targetDir = join(workspace, "skills", slug);

    if (!existsSync(targetDir)) {
      throw new Error(`Skill not installed in workspace: ${slug}`);
    }

    rmSync(targetDir, { recursive: true, force: true });

    return {
      message: `Uninstalled skill: ${slug}`
    };
  }

  private async enableMcp(name: string): Promise<UserFacingResult> {
    return await this.createMcpMarketplaceOps().enable(name);
  }

  private async disableMcp(name: string): Promise<UserFacingResult> {
    return await this.createMcpMarketplaceOps().disable(name);
  }

  private async removeMcp(name: string): Promise<UserFacingResult> {
    return await this.createMcpMarketplaceOps().remove(name);
  }

  private async doctorMcp(name: string): Promise<MarketplaceMcpDoctorResult> {
    return await this.createMcpMarketplaceOps().doctor(name);
  }

  private createMcpMarketplaceOps(): ServiceMcpMarketplaceOps {
    return new ServiceMcpMarketplaceOps({
      applyLiveConfigReload: this.deps.applyLiveConfigReload
    });
  }
}
