import { parse as parseYaml } from "yaml";

export type LocalizedTextMap = Record<string, string>;

export type SkillFrontmatter = {
  name?: string;
  summary?: string;
  summaryI18n?: LocalizedTextMap;
  description?: string;
  descriptionI18n?: LocalizedTextMap;
  author?: string;
  tags?: string[];
};

export function parseSkillFrontmatter(raw: string): SkillFrontmatter {
  const frontmatter = parseFrontmatterBlock(raw);
  if (!frontmatter) {
    return {};
  }

  const parsed = parseYamlFrontmatter(frontmatter);
  const summaryI18n = readLocalizedTextMap(parsed, "summaryi18n", "summary_i18n");
  const descriptionI18n = readLocalizedTextMap(parsed, "descriptioni18n", "description_i18n");

  return {
    name: readString(parsed, "name"),
    summary: readString(parsed, "summary"),
    summaryI18n: mergeLocalizedTextMap(summaryI18n, { zh: readString(parsed, "summaryzh", "summary_zh") }),
    description: readString(parsed, "description"),
    descriptionI18n: mergeLocalizedTextMap(descriptionI18n, {
      zh: readString(parsed, "descriptionzh", "description_zh"),
    }),
    author: readString(parsed, "author"),
    tags: readTags(parsed),
  };
}

export function stripSkillFrontmatter(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n[\s\S]*?\n---\n?/);
  return match ? normalized.slice(match[0].length).trim() : normalized.trim();
}

export function buildLocalizedTextMap(
  englishText: string,
  ...maps: Array<LocalizedTextMap | Partial<LocalizedTextMap> | undefined>
): LocalizedTextMap {
  return {
    ...(mergeLocalizedTextMap(...maps) ?? {}),
    en: englishText,
  };
}

function parseFrontmatterBlock(raw: string): string | null {
  const match = raw.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/);
  return match?.[1] ?? null;
}

function parseYamlFrontmatter(raw: string): Record<string, unknown> {
  try {
    const parsed = parseYaml(raw);
    return isRecord(parsed) ? parsed : {};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid SKILL.md frontmatter: ${message}`);
  }
}

function readString(record: Record<string, unknown>, ...names: string[]): string | undefined {
  const value = readValue(record, names);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readLocalizedTextMap(record: Record<string, unknown>, ...names: string[]): LocalizedTextMap | undefined {
  const value = readValue(record, names);
  if (!isRecord(value)) {
    return undefined;
  }

  const localized = Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0)
      .map(([locale, text]) => [normalizeLocaleTag(locale), text.trim()]),
  );
  return Object.keys(localized).length > 0 ? localized : undefined;
}

function readTags(record: Record<string, unknown>): string[] | undefined {
  const value = readValue(record, ["tags"]);
  const tags = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const normalized = tags
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function mergeLocalizedTextMap(
  ...maps: Array<LocalizedTextMap | Partial<LocalizedTextMap> | undefined>
): LocalizedTextMap | undefined {
  const localized = Object.fromEntries(
    maps.flatMap((map) =>
      Object.entries(map ?? {})
        .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0)
        .map(([locale, text]) => [normalizeLocaleTag(locale), text.trim()]),
    ),
  );
  return Object.keys(localized).length > 0 ? localized : undefined;
}

function readValue(record: Record<string, unknown>, names: string[]): unknown {
  const normalizedNames = names.map(normalizeFrontmatterKey);
  const matchingKey = Object.keys(record).find((candidate) =>
    normalizedNames.includes(normalizeFrontmatterKey(candidate)),
  );
  return matchingKey ? record[matchingKey] : undefined;
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
