import type { Command } from "commander";
import type { NextclawServiceRuntime } from "@nextclaw/service";

export function registerSkillsCommands(program: Command, nextclaw: NextclawServiceRuntime): void {
  const skillsCommands = nextclaw.commands.skills;
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
