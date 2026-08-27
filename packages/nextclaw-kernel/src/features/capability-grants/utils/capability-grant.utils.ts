import { createHash } from "node:crypto";
import type {
  CapabilityGrant,
  CapabilityGrantFilter,
  CapabilityGrantRequest,
} from "@kernel/features/capability-grants/types/capability-grant.types.js";

export function normalizeCapabilityGrantRequest(
  request: CapabilityGrantRequest,
): CapabilityGrantRequest {
  const subjectType = requireString(request.subject.type, "subject.type");
  const subjectId = requireString(request.subject.id, "subject.id");
  const resourceType = requireString(request.resource.type, "resource.type");
  const access = [...new Set(request.access.map((value) => requireString(value, "access")))].sort();
  if (access.length === 0) {
    throw new Error("Capability grant access must not be empty.");
  }
  return {
    subject: { type: subjectType, id: subjectId },
    resource: {
      type: resourceType,
      target: normalizeJsonValue(request.resource.target),
    },
    access,
    declarationFingerprint: requireString(
      request.declarationFingerprint,
      "declarationFingerprint",
    ),
  };
}

export function createCapabilityDeclarationFingerprint(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function getCapabilityGrantKey(request: CapabilityGrantRequest): string {
  const normalized = normalizeCapabilityGrantRequest(request);
  return createHash("sha256").update(stableStringify({
    subject: normalized.subject,
    resource: normalized.resource,
    declarationFingerprint: normalized.declarationFingerprint,
  })).digest("hex");
}

export function capabilityGrantCovers(
  grant: CapabilityGrant,
  request: CapabilityGrantRequest,
): boolean {
  const normalized = normalizeCapabilityGrantRequest(request);
  return getCapabilityGrantKey(grant) === getCapabilityGrantKey(normalized) &&
    normalized.access.every((access) => grant.access.includes(access));
}

export function matchesCapabilityGrantFilter(
  grant: CapabilityGrant,
  filter: CapabilityGrantFilter,
): boolean {
  if (filter.subject?.type && grant.subject.type !== filter.subject.type) return false;
  if (filter.subject?.id && grant.subject.id !== filter.subject.id) return false;
  if (filter.resourceType && grant.resource.type !== filter.resourceType) return false;
  if (
    filter.access &&
    stableStringify([...grant.access].sort()) !==
      stableStringify([...new Set(filter.access)].sort())
  ) return false;
  if (filter.target !== undefined && stableStringify(grant.resource.target) !== stableStringify(filter.target)) {
    return false;
  }
  return true;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(normalizeJsonValue(value)));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, sortValue(value[key])]),
  );
}

function normalizeJsonValue(value: unknown): unknown {
  if (
    value === null || typeof value === "string" || typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeJsonValue(item)]));
  }
  throw new Error("Capability grant target must be JSON-compatible.");
}

function requireString(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Capability grant ${field} is required.`);
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
