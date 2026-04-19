import { DomainValidationError } from "../../domain/errors";
import type { MarketplaceSkillPublishActor } from "../d1-data-source";
import type {
  MarketplaceAdminAppReviewStatus,
  MarketplaceAppOwnerVisibility,
  MarketplaceAppPublishInput,
} from "./app-marketplace.types";
import { OFFICIAL_APPS_WEB_BASE_URL } from "./app-marketplace.types";

export type ExistingAppRow = {
  id: string;
  slug: string;
  app_id: string;
  owner_scope: string | null;
  owner_user_id: string | null;
  app_name: string | null;
  published_at: string;
};

export type MarketplaceResolvedAppIdentity = {
  ownerScope: string;
  ownerUserId: string | null;
  appName: string;
  slug: string;
  appId: string;
};

export type MarketplaceAppReviewInput = {
  selector: string;
  publishStatus: MarketplaceAdminAppReviewStatus;
  reviewNote?: string;
};

export function resolveAppIdentity(
  input: MarketplaceAppPublishInput,
  actor: MarketplaceSkillPublishActor,
): MarketplaceResolvedAppIdentity {
  const parsed = parseAppId(input.appId);
  if (parsed.ownerScope === "nextclaw") {
    if (actor.role !== "admin") {
      throw new DomainValidationError("official scope publishing requires admin permission");
    }
    return {
      ownerScope: parsed.ownerScope,
      ownerUserId: null,
      appName: parsed.appName,
      slug: input.slug,
      appId: input.appId,
    };
  }

  if (actor.authType !== "platform_user" || !actor.userId || !actor.username) {
    throw new DomainValidationError("personal scope publishing requires a logged-in platform user with username");
  }
  if (parsed.ownerScope !== actor.username) {
    throw new DomainValidationError(`personal app scope must match your username: ${actor.username}.*`);
  }
  return {
    ownerScope: parsed.ownerScope,
    ownerUserId: actor.userId,
    appName: parsed.appName,
    slug: `${parsed.ownerScope}--${input.slug}`,
    appId: input.appId,
  };
}

export function assertExistingAppOwnership(
  existing: ExistingAppRow,
  next: MarketplaceResolvedAppIdentity,
  actor: MarketplaceSkillPublishActor,
): void {
  if (existing.app_id !== next.appId || normalizeScope(existing.owner_scope) !== next.ownerScope || normalizeAppName(existing.app_name, existing.app_id) !== next.appName) {
    throw new DomainValidationError("existing app identity does not match requested app");
  }
  if (next.ownerScope === "nextclaw") {
    if (actor.role !== "admin") {
      throw new DomainValidationError("official scope publishing requires admin permission");
    }
    return;
  }
  if (!actor.userId || existing.owner_user_id !== actor.userId) {
    throw new DomainValidationError("you can only update apps in your own scope");
  }
}

export function parseAppReviewInput(rawInput: unknown): MarketplaceAppReviewInput {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new DomainValidationError("body must be an object");
  }
  const candidate = rawInput as Record<string, unknown>;
  const selector = readString(candidate.selector, "body.selector");
  const publishStatus = readString(candidate.publishStatus, "body.publishStatus");
  const reviewNote = readOptionalString(candidate.reviewNote, "body.reviewNote")?.trim();
  if (publishStatus !== "published" && publishStatus !== "rejected") {
    throw new DomainValidationError("body.publishStatus must be published or rejected");
  }
  if (publishStatus === "rejected" && !reviewNote) {
    throw new DomainValidationError("body.reviewNote is required when publishStatus is rejected");
  }
  return {
    selector,
    publishStatus,
    reviewNote,
  };
}

export function deriveOwnerVisibility(value: string | null | undefined): MarketplaceAppOwnerVisibility {
  return value === "hidden" ? "hidden" : "public";
}

export function buildAppWebUrl(slug: string): string {
  return `${OFFICIAL_APPS_WEB_BASE_URL}/apps/${slug}`;
}

function parseAppId(appId: string): { ownerScope: string; appName: string } {
  const match = appId.trim().match(/^([a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?)\.([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (!match) {
    throw new DomainValidationError("body.appId must match scope.name in lowercase");
  }
  const ownerScope = match[1];
  const appName = match[2];
  if (!ownerScope || !appName) {
    throw new DomainValidationError("body.appId must match scope.name in lowercase");
  }
  return {
    ownerScope,
    appName,
  };
}

function normalizeScope(value: string | null | undefined): string {
  return value?.trim() || "nextclaw";
}

function normalizeAppName(value: string | null | undefined, appId: string): string {
  return value?.trim() || appId.split(".").slice(1).join(".") || appId;
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new DomainValidationError(`${path} must be a non-empty string`);
  }
  return value.trim();
}

function readOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return readString(value, path);
}
