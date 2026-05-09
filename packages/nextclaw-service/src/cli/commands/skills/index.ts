import type { Command } from "commander";
import { loadConfig } from "@nextclaw/core";
import { resolveSkillsInstallWorkdir } from "@nextclaw-service/shared/utils/runtime-helpers.js";
import {
  buildMarketplacePublishOptions,
  buildMarketplaceUpdateOptions,
  type MarketplacePublishCommandOptions,
} from "./marketplace-command-options.utils.js";
import { installMarketplaceSkill, publishMarketplaceSkill } from "./marketplace.service.js";
import { SkillsQueryService } from "./skills-query.service.js";
import type { MarketplaceSkillsRecommendCommandOptions, MarketplaceSkillsSearchCommandOptions, SkillsInfoCommandOptions, SkillsInstalledCommandOptions } from "@nextclaw-service/shared/types/cli.types.js";

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

type SkillsCommandHandler = Pick<
  SkillsCommands,
  | "installed"
  | "info"
  | "install"
  | "publish"
  | "update"
  | "marketplaceSearch"
  | "marketplaceInfo"
  | "marketplaceRecommend"
>;

export function registerSkillsCommands(program: Command, skillsCommands: SkillsCommandHandler): void {
  const skills = program.command("skills").description("Manage skills");
  skills
    .command("installed")
    .description("List installed skills from the local runtime")
    .option("--workdir <dir>", "Workspace directory to inspect")
    .option("--scope <scope>", "Filter by scope: all|builtin|project|workspace", "all")
    .option("-q, --query <text>", "Filter installed skills by query")
    .option("--json", "Output JSON", false)
    .action(async (opts) => await skillsCommands.installed(opts));

  skills
    .command("info <selector>")
    .description("Show installed skill details from the local runtime")
    .option("--workdir <dir>", "Workspace directory to inspect")
    .option("--json", "Output JSON", false)
    .action(async (selector, opts) => await skillsCommands.info(selector, opts));

  skills
    .command("install <slug>")
    .description("Install a skill from NextClaw marketplace")
    .option("--api-base <url>", "Marketplace API base URL")
    .option("--workdir <dir>", "Workspace directory to install into")
    .option("--dir <dir>", "Skills directory name (default: skills)")
    .option("-f, --force", "Overwrite existing skill files", false)
    .action(async (slug, opts) => await skillsCommands.install({ slug, ...opts, apiBaseUrl: opts.apiBase }));

  const withRepeatableTag = (value: string, previous: string[] = []) => [...previous, value];

  skills
    .command("publish <dir>")
    .description("Upload or create a skill in marketplace")
    .option("--meta <path>", "Marketplace metadata file (default: <dir>/marketplace.json)")
    .option("--slug <slug>", "Skill name segment (default: directory name)")
    .option("--package-name <name>", "Canonical package name, for example @alice/demo-skill")
    .option("--scope <scope>", "Package scope, for example alice or nextclaw")
    .option("--name <name>", "Skill display name")
    .option("--summary <summary>", "Skill summary")
    .option("--description <description>", "Skill description")
    .option("--author <author>", "Skill author")
    .option("--tag <tag>", "Skill tag (repeatable)", withRepeatableTag, [])
    .option("--source-repo <url>", "Source repository URL")
    .option("--homepage <url>", "Homepage URL")
    .option("--published-at <datetime>", "Published time (ISO datetime)")
    .option("--updated-at <datetime>", "Updated time (ISO datetime)")
    .option("--api-base <url>", "Marketplace API base URL")
    .option("--token <token>", "Marketplace admin token for official @nextclaw/* publishing")
    .action(async (dir, opts) => await skillsCommands.publish({ dir, ...opts, apiBaseUrl: opts.apiBase }));

  skills
    .command("update <dir>")
    .description("Update an existing skill in marketplace")
    .option("--meta <path>", "Marketplace metadata file (default: <dir>/marketplace.json)")
    .option("--slug <slug>", "Skill name segment (default: directory name)")
    .option("--package-name <name>", "Canonical package name, for example @alice/demo-skill")
    .option("--scope <scope>", "Package scope, for example alice or nextclaw")
    .option("--name <name>", "Skill display name")
    .option("--summary <summary>", "Skill summary")
    .option("--description <description>", "Skill description")
    .option("--author <author>", "Skill author")
    .option("--tag <tag>", "Skill tag (repeatable)", withRepeatableTag, [])
    .option("--source-repo <url>", "Source repository URL")
    .option("--homepage <url>", "Homepage URL")
    .option("--updated-at <datetime>", "Updated time (ISO datetime)")
    .option("--api-base <url>", "Marketplace API base URL")
    .option("--token <token>", "Marketplace admin token for official @nextclaw/* publishing")
    .action(async (dir, opts) => await skillsCommands.update({ dir, ...opts, apiBaseUrl: opts.apiBase }));

  const marketplace = program.command("marketplace").description("Browse and install marketplace items");
  const marketplaceSkills = marketplace.command("skills").description("Browse marketplace skill catalog");

  marketplaceSkills
    .command("search")
    .description("Search marketplace skills")
    .option("--api-base <url>", "Marketplace API base URL")
    .option("-q, --query <text>", "Search text")
    .option("--tag <tag>", "Filter by tag")
    .option("--sort <sort>", "Sort by relevance or updated")
    .option("--page <n>", "Page number")
    .option("--page-size <n>", "Page size")
    .option("--json", "Output JSON", false)
    .action(async (opts) => await skillsCommands.marketplaceSearch(opts));

  marketplaceSkills
    .command("info <slug>")
    .description("Show marketplace skill details")
    .option("--api-base <url>", "Marketplace API base URL")
    .option("--json", "Output JSON", false)
    .action(async (slug, opts) => await skillsCommands.marketplaceInfo(slug, opts));

  marketplaceSkills
    .command("recommend")
    .description("List recommended marketplace skills")
    .option("--api-base <url>", "Marketplace API base URL")
    .option("--scene <scene>", "Recommendation scene")
    .option("--limit <n>", "Maximum number of items")
    .option("--json", "Output JSON", false)
    .action(async (opts) => await skillsCommands.marketplaceRecommend(opts));

  marketplaceSkills
    .command("install <slug>")
    .description("Install a skill from marketplace")
    .option("--api-base <url>", "Marketplace API base URL")
    .option("--workdir <dir>", "Workspace directory to install into")
    .option("--dir <dir>", "Skills directory name (default: skills)")
    .option("-f, --force", "Overwrite existing skill files", false)
    .action(async (slug, opts) => await skillsCommands.install({ slug, ...opts, apiBaseUrl: opts.apiBase }));
}
