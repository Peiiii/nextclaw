import { getSkillsPath, getWorkspacePath, loadConfig } from "@nextclaw/core";
import type {
  MarketplaceInstallSkillParams,
  MarketplaceInstaller,
  MarketplaceMcpDoctorResult,
  MarketplaceMcpInstallRequest
} from "@nextclaw/server";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  buildMarketplaceSkillInstallArgs,
  buildMarketplaceSkillUpdateArgs,
  pickUserFacingCommandSummary
} from "@nextclaw-service/shared/utils/marketplace/service-marketplace-helpers.utils.js";
import { ServiceMcpMarketplaceOps } from "@nextclaw-service/shared/services/marketplace/service-mcp-marketplace-ops.js";

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
      installSkill: (params) => this.installSkill(params),
      updateSkill: (params) => this.updateSkill(params),
      installMcp: (params) => this.installMcp(params),
      uninstallSkill: (slug) => this.uninstallSkill(slug),
      enableMcp: (name) => this.enableMcp(name),
      disableMcp: (name) => this.disableMcp(name),
      removeMcp: (name) => this.removeMcp(name),
      doctorMcp: (name) => this.doctorMcp(name)
    };
  }

  private async installSkill(params: MarketplaceInstallSkillParams): Promise<UserFacingResult> {
    const { force, kind, slug } = params;
    if (kind === "builtin") {
      const result = this.deps.installBuiltinSkill(slug, force);
      if (!result) {
        throw new Error(`Builtin skill not found: ${slug}`);
      }
      return result;
    }

    if (kind && kind !== "marketplace") {
      throw new Error(`Unsupported marketplace skill kind: ${kind}`);
    }

    const workspace = getWorkspacePath(loadConfig().agents.defaults.workspace);
    const args = buildMarketplaceSkillInstallArgs({
      slug,
      workspace,
      force
    });

    try {
      const output = await this.deps.runCliSubcommand(args);
      const summary = pickUserFacingCommandSummary(output, `Installed skill: ${slug}`);
      return { message: summary };
    } catch (error) {
      const fallback = this.deps.installBuiltinSkill(slug, force);
      if (!fallback) {
        throw error;
      }
      return fallback;
    }
  }

  private async installMcp(params: MarketplaceMcpInstallRequest): Promise<{ name: string; message: string; output?: string }> {
    return await this.createMcpMarketplaceOps().install(params);
  }

  private async updateSkill(params: MarketplaceInstallSkillParams): Promise<UserFacingResult> {
    const workspace = getWorkspacePath(loadConfig().agents.defaults.workspace);
    const output = await this.deps.runCliSubcommand(buildMarketplaceSkillUpdateArgs({
      slug: params.slug,
      workspace,
      force: params.force
    }));
    const summary = pickUserFacingCommandSummary(output, `Updated skill: ${params.slug}`);
    return { message: summary, output };
  }

  private async uninstallSkill(slug: string): Promise<UserFacingResult> {
    const workspace = getWorkspacePath(loadConfig().agents.defaults.workspace);
    const targetDir = join(getSkillsPath(workspace), slug);

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
