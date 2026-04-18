import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AppManifest } from "../manifest/app-manifest.types.js";
import type { AppMarketplaceMetadata } from "./app-publish.types.js";

export class AppMarketplaceMetadataService {
  load = async (params: {
    appDirectory: string;
    manifest: AppManifest;
    metadataPath?: string;
  }): Promise<AppMarketplaceMetadata> => {
    const metadataPath = params.metadataPath
      ? path.resolve(params.metadataPath)
      : path.join(path.resolve(params.appDirectory), "marketplace.json");
    const raw = JSON.parse(await readFile(metadataPath, "utf-8")) as unknown;
    return this.parseMetadata(raw, params.manifest);
  };

  collectPublishFiles = async (params: {
    appDirectory: string;
    metadataPath?: string;
  }): Promise<Array<{ path: string; bytes: Buffer }>> => {
    const appDirectory = path.resolve(params.appDirectory);
    const publishFiles: Array<{ path: string; bytes: Buffer }> = [];
    const metadataPath = params.metadataPath
      ? path.resolve(params.metadataPath)
      : path.join(appDirectory, "marketplace.json");
    publishFiles.push({
      path: "marketplace.json",
      bytes: Buffer.from(await readFile(metadataPath)),
    });
    const readmePath = path.join(appDirectory, "README.md");
    if (existsSync(readmePath)) {
      publishFiles.push({
        path: "README.md",
        bytes: Buffer.from(await readFile(readmePath)),
      });
    }
    return publishFiles;
  };

  private parseMetadata = (
    rawMetadata: unknown,
    manifest: AppManifest,
  ): AppMarketplaceMetadata => {
    if (!rawMetadata || typeof rawMetadata !== "object" || Array.isArray(rawMetadata)) {
      throw new Error("marketplace.json 必须是对象。");
    }
    const candidate = rawMetadata as Record<string, unknown>;
    const slug = this.readRequiredString(candidate.slug, "slug");
    const summary = this.readRequiredString(candidate.summary, "summary");
    const description = this.readOptionalString(candidate.description, "description");
    const author =
      this.readOptionalString(candidate.author, "author") ?? manifest.name;
    const publisher = this.parsePublisher(candidate.publisher);
    return {
      slug,
      summary,
      summaryI18n: this.readLocalizedTextMap(candidate.summaryI18n, "summaryI18n", summary),
      description,
      descriptionI18n: description
        ? this.readLocalizedTextMap(candidate.descriptionI18n, "descriptionI18n", description)
        : undefined,
      author,
      tags: this.readStringArray(candidate.tags, "tags"),
      sourceRepo: this.readOptionalString(candidate.sourceRepo, "sourceRepo"),
      homepage: this.readOptionalString(candidate.homepage, "homepage"),
      featured: this.readOptionalBoolean(candidate.featured, "featured") ?? false,
      publisher,
    };
  };

  private parsePublisher = (
    rawPublisher: unknown,
  ): AppMarketplaceMetadata["publisher"] => {
    if (rawPublisher === undefined) {
      return undefined;
    }
    if (!rawPublisher || typeof rawPublisher !== "object" || Array.isArray(rawPublisher)) {
      throw new Error("publisher 必须是对象。");
    }
    const candidate = rawPublisher as Record<string, unknown>;
    return {
      id: this.readRequiredString(candidate.id, "publisher.id"),
      name: this.readRequiredString(candidate.name, "publisher.name"),
      url: this.readOptionalString(candidate.url, "publisher.url"),
    };
  };

  private readRequiredString = (value: unknown, fieldName: string): string => {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${fieldName} 必须是非空字符串。`);
    }
    return value.trim();
  };

  private readOptionalString = (
    value: unknown,
    fieldName: string,
  ): string | undefined => {
    if (value === undefined) {
      return undefined;
    }
    return this.readRequiredString(value, fieldName);
  };

  private readStringArray = (value: unknown, fieldName: string): string[] => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(`${fieldName} 必须是非空字符串数组。`);
    }
    return value.map((item, index) =>
      this.readRequiredString(item, `${fieldName}[${index}]`),
    );
  };

  private readOptionalBoolean = (
    value: unknown,
    fieldName: string,
  ): boolean | undefined => {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== "boolean") {
      throw new Error(`${fieldName} 必须是布尔值。`);
    }
    return value;
  };

  private readLocalizedTextMap = (
    value: unknown,
    fieldName: string,
    fallbackEn: string,
  ): Record<string, string> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${fieldName} 必须是对象。`);
    }
    const candidate = value as Record<string, unknown>;
    const normalized = Object.fromEntries(
      Object.entries(candidate).map(([locale, localeValue]) => [
        locale,
        this.readRequiredString(localeValue, `${fieldName}.${locale}`),
      ]),
    );
    if (!normalized.en) {
      normalized.en = fallbackEn;
    }
    return normalized;
  };
}
