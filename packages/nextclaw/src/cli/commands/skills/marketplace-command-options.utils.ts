import { expandHome } from "@nextclaw/core";
import type { MarketplaceSkillPublishOptions } from "./marketplace.js";

export type MarketplacePublishCommandOptions = {
  dir: string;
  meta?: string;
  slug?: string;
  packageName?: string;
  scope?: string;
  name?: string;
  summary?: string;
  description?: string;
  author?: string;
  tag?: string[];
  sourceRepo?: string;
  homepage?: string;
  publishedAt?: string;
  updatedAt?: string;
  apiBaseUrl?: string;
  token?: string;
};

export function buildMarketplacePublishOptions(options: MarketplacePublishCommandOptions): MarketplaceSkillPublishOptions {
  const {
    apiBaseUrl,
    author,
    description,
    dir,
    homepage,
    meta,
    name,
    packageName,
    publishedAt,
    scope,
    slug,
    sourceRepo,
    summary,
    tag,
    token,
    updatedAt
  } = options;
  return {
    skillDir: expandHome(dir),
    metaFile: meta ? expandHome(meta) : undefined,
    slug,
    packageName,
    scope,
    name,
    summary,
    description,
    author,
    tags: tag,
    sourceRepo,
    homepage,
    publishedAt,
    updatedAt,
    apiBaseUrl,
    token
  };
}

export function buildMarketplaceUpdateOptions(
  options: Omit<MarketplacePublishCommandOptions, "publishedAt">
): MarketplaceSkillPublishOptions {
  return {
    ...buildMarketplacePublishOptions(options),
    requireExisting: true
  };
}
