import { loadConfig } from "@nextclaw/core";
import { resolveSkillsInstallWorkdir } from "@nextclaw-service/utils/runtime-helpers.utils.js";
import {
  buildMarketplacePublishOptions,
  buildMarketplaceUpdateOptions,
  type MarketplacePublishCommandOptions,
} from "@nextclaw-service/utils/marketplace/marketplace-command-options.utils.js";
import {
  installMarketplaceSkill,
  publishMarketplaceSkill,
  updateInstalledMarketplaceSkill
} from "@nextclaw-service/utils/marketplace/marketplace.utils.js";
import { SkillsQueryService } from "@nextclaw-service/services/marketplace/skills-query.service.js";
import type {
  MarketplaceSkillsRecommendCommandOptions,
  MarketplaceSkillsSearchCommandOptions,
  MarketplaceSkillsUpdateCommandOptions,
  SkillsInfoCommandOptions,
  SkillsInstalledCommandOptions
} from "@nextclaw-service/types/cli.types.js";

export class SkillsCommands {
  private readonly skillsQueryService = new SkillsQueryService();

  installed = async (options: SkillsInstalledCommandOptions = {}): Promise<void> => {
    const config = loadConfig();
    const workdir = resolveSkillsInstallWorkdir({
      explicitWorkdir: options.workdir,
      configuredWorkspace: config.agents.defaults.workspace,
    });
    const result = this.skillsQueryService.listInstalled({
      workdir,
      scope: options.scope,
      query: options.query,
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (result.skills.length === 0) {
      console.log("No installed skills found.");
      return;
    }

    for (const skill of result.skills) {
      console.log(`${skill.name} (${skill.scope})`);
      console.log(`  ref: ${skill.ref}`);
      console.log(`  path: ${skill.path}`);
      console.log(`  summary: ${skill.summary ?? "-"}`);
      console.log(`  description: ${skill.description ?? "-"}`);
      console.log(`  tags: ${skill.tags.join(", ") || "-"}`);
      console.log(`  always: ${skill.always ? "yes" : "no"}`);
    }
  };

  info = async (selector: string, options: SkillsInfoCommandOptions = {}): Promise<void> => {
    const config = loadConfig();
    const workdir = resolveSkillsInstallWorkdir({
      explicitWorkdir: options.workdir,
      configuredWorkspace: config.agents.defaults.workspace,
    });
    const result = this.skillsQueryService.getInstalledInfo({
      workdir,
      selector,
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`${result.name} (${result.scope})`);
    console.log(`  ref: ${result.ref}`);
    console.log(`  path: ${result.path}`);
    console.log(`  summary: ${result.summary ?? "-"}`);
    console.log(`  description: ${result.description ?? "-"}`);
    console.log(`  author: ${result.author ?? "-"}`);
    console.log(`  tags: ${result.tags.join(", ") || "-"}`);
    console.log(`  always: ${result.always ? "yes" : "no"}`);
  };

  install = async (options: {
    slug: string;
    workdir?: string;
    dir?: string;
    force?: boolean;
    apiBaseUrl?: string;
  }): Promise<void> => {
    const { apiBaseUrl, dir, force, slug, workdir: explicitWorkdir } = options;
    const config = loadConfig();
    const workdir = resolveSkillsInstallWorkdir({
      explicitWorkdir,
      configuredWorkspace: config.agents.defaults.workspace,
    });
    const result = await installMarketplaceSkill({
      slug,
      workdir,
      dir,
      force,
      apiBaseUrl,
    });

    if (result.alreadyInstalled) {
      console.log(`✓ ${result.slug} is already installed`);
    } else {
      console.log(`✓ Installed ${result.slug} (${result.source})`);
    }
    console.log(`  Path: ${result.destinationDir}`);
  };

  marketplaceSearch = async (options: MarketplaceSkillsSearchCommandOptions = {}): Promise<void> => {
    const result = await this.skillsQueryService.searchMarketplaceSkills({
      apiBaseUrl: options.apiBase,
      query: options.query,
      tag: options.tag,
      sort: options.sort,
      page: options.page,
      pageSize: options.pageSize,
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (result.items.length === 0) {
      console.log("No marketplace skills found.");
      return;
    }

    for (const item of result.items) {
      console.log(`${item.name} (${item.slug})`);
      console.log(`  summary: ${item.summary}`);
      console.log(`  author: ${item.author}`);
      console.log(`  tags: ${item.tags.join(", ") || "-"}`);
      console.log(`  install: ${item.install.command}`);
    }
  };

  marketplaceInfo = async (slug: string, options: { apiBase?: string; json?: boolean } = {}): Promise<void> => {
    const result = await this.skillsQueryService.getMarketplaceSkillInfo({
      apiBaseUrl: options.apiBase,
      slug,
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`${result.item.name} (${result.item.slug})`);
    console.log(`  summary: ${result.item.summary}`);
    console.log(`  description: ${result.item.description ?? "-"}`);
    console.log(`  author: ${result.item.author}`);
    console.log(`  tags: ${result.item.tags.join(", ") || "-"}`);
    console.log(`  install: ${result.item.install.command}`);
    console.log(`  content: ${result.content ? "available" : "unavailable"}`);
    if (result.content) {
      console.log(`  source: ${result.content.source}`);
    } else if (result.contentUnavailableReason) {
      console.log(`  reason: ${result.contentUnavailableReason}`);
    }
  };

  marketplaceRecommend = async (options: MarketplaceSkillsRecommendCommandOptions = {}): Promise<void> => {
    const result = await this.skillsQueryService.recommendMarketplaceSkills({
      apiBaseUrl: options.apiBase,
      scene: options.scene,
      limit: options.limit,
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`${result.title} (${result.sceneId})`);
    if (result.description) {
      console.log(`  ${result.description}`);
    }
    for (const item of result.items) {
      console.log(`- ${item.name} (${item.slug})`);
    }
  };

  marketplaceUpdateInstalled = async (
    slug: string,
    options: MarketplaceSkillsUpdateCommandOptions = {}
  ): Promise<void> => {
    const config = loadConfig();
    const workdir = resolveSkillsInstallWorkdir({
      explicitWorkdir: options.workdir,
      configuredWorkspace: config.agents.defaults.workspace,
    });
    const result = await updateInstalledMarketplaceSkill({
      slug,
      workdir,
      dir: options.dir,
      force: options.force,
      apiBaseUrl: options.apiBase,
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (result.updated) {
      console.log(`✓ Updated ${result.slug}`);
    } else {
      console.log(`✓ ${result.slug} is already up to date`);
    }
    console.log(`  Path: ${result.destinationDir}`);
  };

  publish = async (options: MarketplacePublishCommandOptions): Promise<void> => {
    const result = await publishMarketplaceSkill(buildMarketplacePublishOptions(options));
    console.log(`${result.created ? `✓ Published new skill: ${result.packageName}` : `✓ Updated skill: ${result.packageName}`}\n  Alias: ${result.slug}\n  Files: ${result.fileCount}`);
  };

  update = async (options: Omit<MarketplacePublishCommandOptions, "publishedAt">): Promise<void> => {
    const result = await publishMarketplaceSkill(buildMarketplaceUpdateOptions(options));
    console.log(`✓ Updated skill: ${result.packageName}`);
    console.log(`  Alias: ${result.slug}`);
    console.log(`  Files: ${result.fileCount}`);
  };
}
