import { DomainValidationError } from "../../domain/errors";
import type { MarketplaceSkillPublishActor, MarketplaceSkillUpsertInput } from "./d1-section-types";

export type ExistingSkillRow = {
  id: string;
  package_name: string;
  owner_scope: string;
  skill_name: string;
  owner_user_id: string | null;
  published_at: string;
};

export type MarketplaceSkillReviewInput = {
  selector: string;
  publishStatus: "published" | "rejected";
  reviewNote?: string;
};

export type MarketplaceResolvedSkillIdentity = {
  slug: string;
  packageName: string;
  ownerUserId: string | null;
  ownerScope: string;
  skillName: string;
};

type MarketplaceSkillValidationTools = {
  isRecord(value: unknown): value is Record<string, unknown>;
  readSlug(value: unknown, path: string): string;
  readString(value: unknown, path: string): string;
  readOptionalString(value: unknown, path: string): string | undefined;
  readLocalizedTextMap(value: unknown, path: string, fallbackEn: string): MarketplaceSkillUpsertInput["summaryI18n"];
  readStringArray(value: unknown, path: string): string[];
  readOptionalDateTime(value: unknown, path: string): string | undefined;
  decodeBase64(raw: string, path: string): Uint8Array;
};

export function parseSkillUpsertInput(
  rawInput: unknown,
  tools: MarketplaceSkillValidationTools
): MarketplaceSkillUpsertInput {
  if (!tools.isRecord(rawInput)) {
    throw new DomainValidationError("body must be an object");
  }

  const slug = rawInput.slug === undefined ? undefined : tools.readSlug(rawInput.slug, "body.slug");
  const packageName = rawInput.packageName === undefined
    ? undefined
    : readPackageName(rawInput.packageName, "body.packageName", tools.readString);
  const id = tools.readOptionalString(rawInput.id, "body.id");
  const name = tools.readString(rawInput.name, "body.name");
  const summary = tools.readString(rawInput.summary, "body.summary");
  const description = tools.readOptionalString(rawInput.description, "body.description");
  const sourceRepo = tools.readOptionalString(rawInput.sourceRepo, "body.sourceRepo");
  const homepage = tools.readOptionalString(rawInput.homepage, "body.homepage");
  const summaryI18n = tools.readLocalizedTextMap(rawInput.summaryI18n, "body.summaryI18n", summary);
  const descriptionI18n = description
    ? tools.readLocalizedTextMap(rawInput.descriptionI18n, "body.descriptionI18n", description)
    : undefined;
  const tags = tools.readStringArray(rawInput.tags, "body.tags");
  const publishedAt = tools.readOptionalDateTime(rawInput.publishedAt, "body.publishedAt");
  const updatedAt = tools.readOptionalDateTime(rawInput.updatedAt, "body.updatedAt");
  const requireExisting = Boolean(rawInput.requireExisting);
  const files = readSkillFiles(rawInput.files, "body.files", tools);

  if (!files.some((file) => file.path === "SKILL.md")) {
    throw new DomainValidationError("body.files must include SKILL.md");
  }

  return {
    id,
    slug,
    packageName,
    requireExisting,
    name,
    summary,
    summaryI18n,
    description,
    descriptionI18n,
    tags,
    sourceRepo,
    homepage,
    files,
    publishedAt,
    updatedAt
  };
}

export function parseSkillReviewInput(
  rawInput: unknown,
  tools: Pick<MarketplaceSkillValidationTools, "isRecord" | "readString" | "readOptionalString">
): MarketplaceSkillReviewInput {
  if (!tools.isRecord(rawInput)) {
    throw new DomainValidationError("body must be an object");
  }

  const selector = tools.readString(rawInput.selector, "body.selector");
  const publishStatus = tools.readString(rawInput.publishStatus, "body.publishStatus");
  const reviewNote = tools.readOptionalString(rawInput.reviewNote, "body.reviewNote")?.trim();
  if (publishStatus !== "published" && publishStatus !== "rejected") {
    throw new DomainValidationError("body.publishStatus must be published or rejected");
  }
  if (publishStatus === "rejected" && !reviewNote) {
    throw new DomainValidationError("body.reviewNote is required when publishStatus is rejected");
  }

  return {
    selector,
    publishStatus,
    reviewNote
  };
}

export function resolveSkillIdentity(
  input: MarketplaceSkillUpsertInput,
  actor: MarketplaceSkillPublishActor
): MarketplaceResolvedSkillIdentity {
  const derivedSkillName = input.slug ?? deriveSlugFromPackageName(input.packageName);
  if (!derivedSkillName) {
    throw new DomainValidationError("body.slug or body.packageName is required");
  }

  const packageName = input.packageName ?? derivePackageNameFromActor(derivedSkillName, actor);
  const parsedPackage = parsePackageName(packageName, "body.packageName");

  if (parsedPackage.ownerScope === "nextclaw") {
    if (actor.role !== "admin") {
      throw new DomainValidationError("official scope publishing requires admin permission");
    }
    return {
      slug: parsedPackage.skillName,
      packageName,
      ownerUserId: null,
      ownerScope: parsedPackage.ownerScope,
      skillName: parsedPackage.skillName
    };
  }

  if (actor.authType !== "platform_user" || !actor.userId || !actor.username) {
    throw new DomainValidationError("personal scope publishing requires a logged-in platform user with username");
  }
  if (parsedPackage.ownerScope !== actor.username) {
    throw new DomainValidationError(`personal scope must match your username: @${actor.username}/*`);
  }

  return {
    slug: `${parsedPackage.ownerScope}--${parsedPackage.skillName}`,
    packageName,
    ownerUserId: actor.userId,
    ownerScope: parsedPackage.ownerScope,
    skillName: parsedPackage.skillName
  };
}

export function assertExistingSkillOwnership(
  existing: ExistingSkillRow,
  next: MarketplaceResolvedSkillIdentity,
  actor: MarketplaceSkillPublishActor
): void {
  if (existing.package_name !== next.packageName || existing.owner_scope !== next.ownerScope || existing.skill_name !== next.skillName) {
    throw new DomainValidationError("existing skill identity does not match requested package");
  }
  if (next.ownerScope === "nextclaw") {
    if (actor.role !== "admin") {
      throw new DomainValidationError("official scope publishing requires admin permission");
    }
    return;
  }
  if (!actor.userId || existing.owner_user_id !== actor.userId) {
    throw new DomainValidationError("you can only update skills in your own scope");
  }
}

function readSkillFiles(
  value: unknown,
  path: string,
  tools: Pick<MarketplaceSkillValidationTools, "isRecord" | "readString" | "decodeBase64">
): Array<{ path: string; contentBase64: string }> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new DomainValidationError(`${path} must be a non-empty array`);
  }

  const normalized = value.map((entry, index) => {
    if (!tools.isRecord(entry)) {
      throw new DomainValidationError(`${path}[${index}] must be an object`);
    }
    const filePath = normalizeFilePath(tools.readString(entry.path, `${path}[${index}].path`), `${path}[${index}].path`);
    const contentBase64 = tools.readString(entry.contentBase64, `${path}[${index}].contentBase64`);
    tools.decodeBase64(contentBase64, `${path}[${index}].contentBase64`);
    return {
      path: filePath,
      contentBase64
    };
  });

  const deduped = new Map<string, { path: string; contentBase64: string }>();
  for (const file of normalized) {
    deduped.set(file.path, file);
  }
  return [...deduped.values()];
}

function normalizeFilePath(raw: string, path: string): string {
  const normalized = raw.replace(/\\/g, "/").trim();
  if (!normalized || normalized.startsWith("/")) {
    throw new DomainValidationError(`${path} must be a relative path`);
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) {
    throw new DomainValidationError(`${path} must be a relative path`);
  }
  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      throw new DomainValidationError(`${path} must not contain traversal segments`);
    }
  }
  return segments.join("/");
}

export function normalizeRelativeFilePath(raw: string, path: string): string {
  return normalizeFilePath(raw, path);
}

function readPackageName(
  value: unknown,
  path: string,
  readString: MarketplaceSkillValidationTools["readString"]
): string {
  const packageName = readString(value, path);
  parsePackageName(packageName, path);
  return packageName;
}

function parsePackageName(value: string, path: string): { ownerScope: string; skillName: string } {
  const match = value.match(/^@([a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?)\/([A-Za-z0-9._-]+)$/);
  if (!match) {
    throw new DomainValidationError(`${path} must match @scope/name`);
  }
  const ownerScope = match[1];
  const skillName = match[2];
  if (!ownerScope || !skillName) {
    throw new DomainValidationError(`${path} must match @scope/name`);
  }
  return {
    ownerScope,
    skillName
  };
}

function deriveSlugFromPackageName(packageName: string | undefined): string | null {
  if (!packageName) {
    return null;
  }
  return parsePackageName(packageName, "body.packageName").skillName;
}

function derivePackageNameFromActor(skillName: string, actor: MarketplaceSkillPublishActor): string {
  if (actor.role === "admin" && actor.authType === "admin_token") {
    return `@nextclaw/${skillName}`;
  }
  if (!actor.username) {
    throw new DomainValidationError("username is required before publishing skills");
  }
  return `@${actor.username}/${skillName}`;
}
