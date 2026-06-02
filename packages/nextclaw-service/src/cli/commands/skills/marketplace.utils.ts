import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  buildLocalizedTextMap,
  parseSkillFrontmatter,
  readMarketplaceMetadataFile,
  type LocalizedTextMap
} from "./marketplace.metadata.js";
import { PlatformAuthCommands } from "@nextclaw-service/commands/platform-auth/index.js";
import {
  collectMarketplaceSkillFiles,
  readMarketplaceEnvelope,
  resolveMarketplaceAdminToken,
  resolveMarketplaceApiBase,
} from "./marketplace-client.js";
import {
  normalizeTags,
  resolvePublishPackageName,
  validateSkillSlug
} from "./marketplace-identity.utils.js";
import { runWithMarketplaceNetworkRetry } from "./marketplace-network-retry.js";
export {
  installMarketplaceSkill,
  updateInstalledMarketplaceSkill,
  type MarketplaceSkillInstallOptions
} from "./utils/marketplace-skill-lifecycle.utils.js";

export type MarketplaceSkillPublishOptions = {
  skillDir: string;
  metaFile?: string;
  slug?: string;
  packageName?: string;
  scope?: string;
  name?: string;
  summary?: string;
  summaryI18n?: LocalizedTextMap;
  description?: string;
  descriptionI18n?: LocalizedTextMap;
  author?: string;
  tags?: string[];
  sourceRepo?: string;
  homepage?: string;
  publishedAt?: string;
  updatedAt?: string;
  apiBaseUrl?: string;
  token?: string;
  requireExisting?: boolean;
};

export async function publishMarketplaceSkill(options: MarketplaceSkillPublishOptions): Promise<{
  created: boolean;
  slug: string;
  packageName: string;
  fileCount: number;
}> {
  const {
    skillDir: rawSkillDir,
    slug: explicitSlug,
    metaFile,
    packageName: explicitPackageName,
    scope: explicitScope,
    name: explicitName,
    summary: explicitSummary,
    summaryI18n: explicitSummaryI18n,
    description: explicitDescription,
    descriptionI18n: explicitDescriptionI18n,
    tags: explicitTags,
    sourceRepo: explicitSourceRepo,
    homepage: explicitHomepage,
    publishedAt: explicitPublishedAt,
    updatedAt: explicitUpdatedAt,
    apiBaseUrl,
    token: explicitToken,
    requireExisting
  } = options;
  const skillDir = resolve(rawSkillDir);
  if (!existsSync(skillDir)) {
    throw new Error(`Skill directory not found: ${skillDir}`);
  }

  const files = collectMarketplaceSkillFiles(skillDir);
  if (!files.some((file) => file.path === "SKILL.md")) {
    throw new Error(`Skill directory must include SKILL.md: ${skillDir}`);
  }

  const parsedFrontmatter = parseSkillFrontmatter(readFileSync(join(skillDir, "SKILL.md"), "utf8"));
  const metadata = readMarketplaceMetadataFile(skillDir, metaFile);
  const slug = validateSkillSlug(explicitSlug?.trim() || metadata.slug || basename(skillDir), "slug");
  const name = explicitName?.trim() || metadata.name || parsedFrontmatter.name || slug;
  const description = explicitDescription?.trim()
    || metadata.description
    || metadata.descriptionI18n?.en
    || parsedFrontmatter.description;
  const summary = explicitSummary?.trim()
    || metadata.summary
    || metadata.summaryI18n?.en
    || parsedFrontmatter.summary
    || description
    || `${slug} skill`;
  const summaryI18n = buildLocalizedTextMap(summary, parsedFrontmatter.summaryI18n, metadata.summaryI18n, explicitSummaryI18n);
  const descriptionI18n = description
    ? buildLocalizedTextMap(description, parsedFrontmatter.descriptionI18n, metadata.descriptionI18n, explicitDescriptionI18n)
    : undefined;
  const tags = normalizeTags(explicitTags && explicitTags.length > 0 ? explicitTags : (metadata.tags ?? parsedFrontmatter.tags));

  const apiBase = resolveMarketplaceApiBase(apiBaseUrl);
  const adminToken = resolveMarketplaceAdminToken(explicitToken);
  const platformAuth = new PlatformAuthCommands();
  const currentUser = adminToken ? null : await platformAuth.me();
  const packageName = resolvePublishPackageName({
    explicitPackageName,
    explicitScope,
    slug,
    adminTokenPresent: Boolean(adminToken),
    currentUser
  });
  const authToken = adminToken ?? currentUser?.token;
  if (!authToken) {
    throw new Error("Publishing requires either a marketplace admin token or an active NextClaw platform login.");
  }

  const response = await runWithMarketplaceNetworkRetry(() =>
    fetch(`${apiBase}/api/v1/skills/publish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        slug,
        packageName,
        name,
        summary,
        summaryI18n,
        description,
        descriptionI18n,
        tags,
        sourceRepo: explicitSourceRepo?.trim() || metadata.sourceRepo,
        homepage: explicitHomepage?.trim() || metadata.homepage,
        publishedAt: explicitPublishedAt?.trim() || metadata.publishedAt,
        updatedAt: explicitUpdatedAt?.trim() || metadata.updatedAt,
        requireExisting,
        files
      })
    })
  );

  const payload = await readMarketplaceEnvelope<{
    created: boolean;
    fileCount: number;
    item?: {
      slug?: string;
      packageName?: string;
    };
  }>(response);

  if (!payload.ok || !payload.data) {
    const message = payload.error?.message || `marketplace publish failed: HTTP ${response.status}`;
    throw new Error(message);
  }

  return {
    created: payload.data.created,
    slug: payload.data.item?.slug || slug,
    packageName: payload.data.item?.packageName || packageName,
    fileCount: payload.data.fileCount
  };
}
