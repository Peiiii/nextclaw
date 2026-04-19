import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const DEFAULT_MARKETPLACE_META_FILENAME = "marketplace.json";

export type LocalizedTextMap = Record<string, string>;

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

export function parseSkillFrontmatter(raw: string): {
  name?: string;
  summary?: string;
  summaryI18n?: LocalizedTextMap;
  description?: string;
  descriptionI18n?: LocalizedTextMap;
  author?: string;
  tags?: string[];
} {
  const normalized = raw.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match || !match[1]) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(match[1]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid SKILL.md frontmatter: ${message}`);
  }

  if (!isRecord(parsed)) {
    return {};
  }

  const summaryI18n = readLocalizedTextMapField(parsed, [["summaryi18n"], ["summary_i18n"]]);
  const descriptionI18n = readLocalizedTextMapField(parsed, [["descriptioni18n"], ["description_i18n"]]);
  const summaryZh = readFrontmatterStringField(parsed, [["summaryzh"], ["summary_zh"]]);
  const descriptionZh = readFrontmatterStringField(parsed, [["descriptionzh"], ["description_zh"]]);

  return {
    name: readFrontmatterStringField(parsed, [["name"]]),
    summary: readFrontmatterStringField(parsed, [["summary"]]),
    summaryI18n: mergeLocalizedTextMap(summaryI18n, { zh: summaryZh }),
    description: readFrontmatterStringField(parsed, [["description"]]),
    descriptionI18n: mergeLocalizedTextMap(descriptionI18n, { zh: descriptionZh }),
    author: readFrontmatterStringField(parsed, [["author"]]),
    tags: readFrontmatterTags(parsed)
  };
}

export function buildLocalizedTextMap(
  englishText: string,
  ...maps: Array<LocalizedTextMap | Partial<LocalizedTextMap> | undefined>
): LocalizedTextMap {
  const normalized = mergeLocalizedTextMap(...maps);
  return {
    ...(normalized ?? {}),
    en: englishText
  };
}

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

function mergeLocalizedTextMap(
  ...maps: Array<LocalizedTextMap | Partial<LocalizedTextMap> | undefined>
): LocalizedTextMap | undefined {
  const localized: LocalizedTextMap = {};

  for (const map of maps) {
    for (const [locale, text] of Object.entries(map ?? {})) {
      const normalizedText = typeof text === "string" ? text.trim() : "";
      if (!normalizedText) {
        continue;
      }
      localized[normalizeLocaleTag(locale)] = normalizedText;
    }
  }

  return Object.keys(localized).length > 0 ? localized : undefined;
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

function readFrontmatterStringField(record: Record<string, unknown>, keyPaths: string[][]): string | undefined {
  for (const keyPath of keyPaths) {
    const value = readNestedFrontmatterValue(record, keyPath);
    if (typeof value !== "string") {
      continue;
    }
    const normalized = value.trim();
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

function readLocalizedTextMapField(record: Record<string, unknown>, keyPaths: string[][]): LocalizedTextMap | undefined {
  for (const keyPath of keyPaths) {
    const value = readNestedFrontmatterValue(record, keyPath);
    if (!isRecord(value)) {
      continue;
    }
    const normalized: LocalizedTextMap = {};
    for (const [locale, text] of Object.entries(value)) {
      if (typeof text !== "string") {
        continue;
      }
      const trimmed = text.trim();
      if (!trimmed) {
        continue;
      }
      normalized[normalizeLocaleTag(locale)] = trimmed;
    }
    if (Object.keys(normalized).length > 0) {
      return normalized;
    }
  }
  return undefined;
}

function readFrontmatterTags(record: Record<string, unknown>): string[] | undefined {
  const rawTags = readNestedFrontmatterValue(record, ["tags"]);
  if (Array.isArray(rawTags)) {
    const tags = rawTags
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
    return tags.length > 0 ? tags : undefined;
  }

  if (typeof rawTags !== "string") {
    return undefined;
  }

  const tags = rawTags
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

function readNestedFrontmatterValue(record: Record<string, unknown>, keyPath: string[]): unknown {
  let current: unknown = record;
  for (const rawKey of keyPath) {
    if (!isRecord(current)) {
      return undefined;
    }
    const normalizedKey = normalizeFrontmatterKey(rawKey);
    const matchingKey = Object.keys(current).find((candidate) => normalizeFrontmatterKey(candidate) === normalizedKey);
    if (!matchingKey) {
      return undefined;
    }
    current = current[matchingKey];
  }
  return current;
}

function normalizeFrontmatterKey(raw: string): string {
  return raw.replace(/[-_]/g, "").toLowerCase();
}

function normalizeLocaleTag(raw: string): string {
  return raw.trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
