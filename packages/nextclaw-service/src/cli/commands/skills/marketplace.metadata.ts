import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildLocalizedTextMap,
  parseSkillFrontmatter,
  type LocalizedTextMap,
} from "@nextclaw/kernel";

const DEFAULT_MARKETPLACE_META_FILENAME = "marketplace.json";

export {
  buildLocalizedTextMap,
  parseSkillFrontmatter,
  type LocalizedTextMap,
};

export type MarketplaceSkillPublishMetadata = {
  slug?: string;
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
};

export function readMarketplaceMetadataFile(
  skillDir: string,
  explicitMetaFile?: string
): MarketplaceSkillPublishMetadata {
  const metadataPath = resolveMarketplaceMetadataPath(skillDir, explicitMetaFile);
  if (!metadataPath) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(metadataPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid marketplace metadata file: ${metadataPath} (${message})`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`Invalid marketplace metadata file: ${metadataPath} (root must be an object)`);
  }

  return {
    slug: readMetadataString(parsed, "slug"),
    name: readMetadataString(parsed, "name"),
    summary: readMetadataString(parsed, "summary"),
    summaryI18n: readMetadataLocalizedTextMap(parsed, "summaryI18n"),
    description: readMetadataString(parsed, "description"),
    descriptionI18n: readMetadataLocalizedTextMap(parsed, "descriptionI18n"),
    author: readMetadataString(parsed, "author"),
    tags: readMetadataStringArray(parsed, "tags"),
    sourceRepo: readMetadataString(parsed, "sourceRepo"),
    homepage: readMetadataString(parsed, "homepage"),
    publishedAt: readMetadataString(parsed, "publishedAt"),
    updatedAt: readMetadataString(parsed, "updatedAt")
  };
}

function resolveMarketplaceMetadataPath(skillDir: string, explicitMetaFile?: string): string | undefined {
  const resolved = explicitMetaFile?.trim()
    ? resolve(explicitMetaFile)
    : resolve(skillDir, DEFAULT_MARKETPLACE_META_FILENAME);
  return existsSync(resolved) ? resolved : undefined;
}

function readMetadataString(record: Record<string, unknown>, fieldName: string): string | undefined {
  const value = record[fieldName];
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Invalid marketplace metadata field: ${fieldName} must be a string`);
  }
  const normalized = value.trim();
  return normalized || undefined;
}

function readMetadataStringArray(record: Record<string, unknown>, fieldName: string): string[] | undefined {
  const value = record[fieldName];
  if (value == null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`Invalid marketplace metadata field: ${fieldName} must be an array`);
  }
  const tags = value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new Error(`Invalid marketplace metadata field: ${fieldName}[${index}] must be a string`);
    }
    return entry.trim();
  }).filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

function readMetadataLocalizedTextMap(record: Record<string, unknown>, fieldName: string): LocalizedTextMap | undefined {
  const value = record[fieldName];
  if (value == null) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error(`Invalid marketplace metadata field: ${fieldName} must be an object`);
  }
  const localized: LocalizedTextMap = {};
  for (const [locale, text] of Object.entries(value)) {
    if (typeof text !== "string") {
      throw new Error(`Invalid marketplace metadata field: ${fieldName}.${locale} must be a string`);
    }
    const normalized = text.trim();
    if (!normalized) {
      continue;
    }
    localized[normalizeLocaleTag(locale)] = normalized;
  }
  return Object.keys(localized).length > 0 ? localized : undefined;
}

function normalizeLocaleTag(raw: string): string {
  return raw.trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
