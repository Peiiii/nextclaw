import type { PlatformMeResult } from "../platform-auth/index.js";

export function resolvePublishPackageName(params: {
  explicitPackageName?: string;
  explicitScope?: string;
  slug: string;
  adminTokenPresent: boolean;
  currentUser: PlatformMeResult | null;
}): string {
  const {
    explicitPackageName,
    explicitScope,
    slug,
    adminTokenPresent,
    currentUser
  } = params;
  const normalizedExplicitPackageName = explicitPackageName?.trim();
  if (normalizedExplicitPackageName) {
    return resolveExplicitPackageName(normalizedExplicitPackageName, adminTokenPresent, currentUser);
  }

  const normalizedScope = explicitScope?.trim().toLowerCase();
  if (normalizedScope) {
    return resolveScopedPackageName(normalizedScope, slug, adminTokenPresent, currentUser);
  }

  return resolveDefaultPackageName(slug, adminTokenPresent, currentUser);
}

function resolveExplicitPackageName(
  packageName: string,
  adminTokenPresent: boolean,
  currentUser: PlatformMeResult | null
): string {
  const parsed = parsePackageName(packageName, "packageName");
  if (parsed.scope === "nextclaw") {
    assertOfficialScopeAllowed(adminTokenPresent, currentUser);
    return packageName;
  }
  assertPersonalScopeAllowed(parsed.scope, currentUser);
  return packageName;
}

function resolveScopedPackageName(
  scope: string,
  slug: string,
  adminTokenPresent: boolean,
  currentUser: PlatformMeResult | null
): string {
  if (scope === "nextclaw") {
    assertOfficialScopeAllowed(adminTokenPresent, currentUser);
    return `@nextclaw/${slug}`;
  }
  assertPersonalScopeAllowed(scope, currentUser);
  return `@${scope}/${slug}`;
}

function resolveDefaultPackageName(
  slug: string,
  adminTokenPresent: boolean,
  currentUser: PlatformMeResult | null
): string {
  if (adminTokenPresent) {
    return `@nextclaw/${slug}`;
  }
  const username = requirePlatformUsername(currentUser);
  return `@${username}/${slug}`;
}

export function validateSkillSlug(raw: string, fieldName: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(raw)) {
    throw new Error(`Invalid ${fieldName}: ${raw}`);
  }
  return raw;
}

export function validateSkillSelector(raw: string, fieldName: string): string {
  if (raw.startsWith("@")) {
    parsePackageName(raw, fieldName);
    return raw;
  }
  return validateSkillSlug(raw, fieldName);
}

export function normalizeTags(rawTags: string[] | undefined): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const rawTag of rawTags ?? []) {
    const tag = rawTag.trim();
    if (!tag || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    output.push(tag);
  }
  return output.length > 0 ? output : ["skill"];
}

function canPublishOfficialScope(
  adminTokenPresent: boolean,
  currentUser: PlatformMeResult | null
): boolean {
  return adminTokenPresent || currentUser?.user.role === "admin";
}

function assertOfficialScopeAllowed(adminTokenPresent: boolean, currentUser: PlatformMeResult | null): void {
  if (!canPublishOfficialScope(adminTokenPresent, currentUser)) {
    throw new Error("Publishing to @nextclaw/* requires admin permission.");
  }
}

function assertPersonalScopeAllowed(scope: string, currentUser: PlatformMeResult | null): void {
  const username = requirePlatformUsername(currentUser);
  if (scope !== username) {
    throw new Error(`Personal publish scope must match your username: @${username}/*`);
  }
}

function requirePlatformUsername(currentUser: PlatformMeResult | null): string {
  const username = currentUser?.user.username;
  if (!username) {
    throw new Error(
      "Set your NextClaw username before publishing personal skills. "
      + "Open NextClaw Web account settings: https://platform.nextclaw.io/account "
      + "or run `nextclaw account set-username <username>`."
    );
  }
  return username;
}

function parsePackageName(raw: string, fieldName: string): { scope: string; name: string } {
  const match = raw.match(/^@([a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?)\/([A-Za-z0-9._-]+)$/);
  if (!match) {
    throw new Error(`Invalid ${fieldName}: ${raw}`);
  }
  return {
    scope: match[1],
    name: match[2]
  };
}
