import { getSkillsPath, getWorkspacePath, loadConfig } from "@nextclaw/core";
import type {
  MarketplaceInstallSkillParams,
  MarketplaceInstaller,
  MarketplaceMcpDoctorResult,
  MarketplaceMcpInstallRequest
} from "@nextclaw/server";
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildMarketplaceSkillInstallArgs,
  buildMarketplaceSkillUpdateArgs,
  pickUserFacingCommandSummary
} from "@nextclaw-service/utils/marketplace/service-marketplace-helpers.utils.js";
import { validateSkillSlug } from "@nextclaw-service/utils/marketplace/marketplace-identity.utils.js";
import { ServiceMcpMarketplaceOps } from "@nextclaw-service/services/marketplace/service-mcp-marketplace-ops.service.js";
import {
  MARKETPLACE_SKILL_LOCAL_CHANGES_MESSAGE_PREFIX,
  MarketplaceSkillLocalChangesError
} from "@nextclaw-service/utils/marketplace/marketplace.utils.js";

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

  createInstaller = (): MarketplaceInstaller => {
    return {
      installSkill: this.installSkill,
      updateSkill: this.updateSkill,
      installMcp: this.installMcp,
      uninstallSkill: this.uninstallSkill,
      enableMcp: this.enableMcp,
      disableMcp: this.disableMcp,
      removeMcp: this.removeMcp,
      doctorMcp: this.doctorMcp
    };
  };

  private installSkill = async (params: MarketplaceInstallSkillParams): Promise<UserFacingResult> => {
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
  };

  private installMcp = async (params: MarketplaceMcpInstallRequest): Promise<{ name: string; message: string; output?: string }> => {
    return await this.createMcpMarketplaceOps().install(params);
  };

  private updateSkill = async (params: MarketplaceInstallSkillParams): Promise<UserFacingResult> => {
    const { force, slug } = params;
    const workspace = getWorkspacePath(loadConfig().agents.defaults.workspace);
    let output: string;
    try {
      output = await this.deps.runCliSubcommand(buildMarketplaceSkillUpdateArgs({
        slug,
        workspace,
        force
      }));
    } catch (error) {
      if (
        !force
        && error instanceof Error
        && error.message.includes(MARKETPLACE_SKILL_LOCAL_CHANGES_MESSAGE_PREFIX)
      ) {
        throw new MarketplaceSkillLocalChangesError(slug);
      }
      throw error;
    }
    const summary = pickUserFacingCommandSummary(output, `Updated skill: ${slug}`);
    return { message: summary, output };
  };

  private uninstallSkill = async (slug: string): Promise<UserFacingResult> => {
    const skillsRoot = getSkillsPath(getWorkspacePath(loadConfig().agents.defaults.workspace));
    const targetDir = resolve(skillsRoot, validateSkillSlug(slug.trim(), "slug"));
    if (dirname(targetDir) !== skillsRoot) {
      throw new Error(`Skill uninstall target must be a direct workspace skill: ${slug}`);
    }

    if (!existsSync(resolve(targetDir, "SKILL.md"))) {
      throw new Error(`Skill not installed in workspace: ${slug}`);
    }

    rmSync(targetDir, { recursive: true });

    return {
      message: `Uninstalled skill: ${slug}`
    };
  };

  private enableMcp = async (name: string): Promise<UserFacingResult> => {
    return await this.createMcpMarketplaceOps().enable(name);
  };

  private disableMcp = async (name: string): Promise<UserFacingResult> => {
    return await this.createMcpMarketplaceOps().disable(name);
  };

  private removeMcp = async (name: string): Promise<UserFacingResult> => {
    return await this.createMcpMarketplaceOps().remove(name);
  };

  private doctorMcp = async (name: string): Promise<MarketplaceMcpDoctorResult> => {
    return await this.createMcpMarketplaceOps().doctor(name);
  };

  private createMcpMarketplaceOps = (): ServiceMcpMarketplaceOps => {
    return new ServiceMcpMarketplaceOps({
      applyLiveConfigReload: this.deps.applyLiveConfigReload
    });
  };
}
