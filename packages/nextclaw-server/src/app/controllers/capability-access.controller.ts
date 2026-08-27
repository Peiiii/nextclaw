import type { Context } from "hono";
import type {
  CapabilityGrantFilter,
  CapabilityGrantManager,
  CapabilityGrantRequest,
  DesktopHostCapabilityManager,
} from "@nextclaw/kernel";
import {
  err,
  isRecord,
  ok,
  readJson,
} from "@nextclaw-server/shared/utils/http-response.utils.js";

type DesktopHostAccessManager = Pick<
  DesktopHostCapabilityManager,
  | "getPermissions"
  | "grantAccess"
  | "openPermissionSettings"
  | "requestPermissions"
  | "status"
>;

export class CapabilityAccessRoutesController {
  constructor(private readonly options: {
    capabilityGrantManager: CapabilityGrantManager;
    getDesktopHost: () => DesktopHostAccessManager;
  }) {}

  readonly listGrants = async (c: Context) =>
    this.listDesktopGrants(c);

  readonly grant = async (c: Context) => {
    const body = await readJson<unknown>(c.req.raw);
    const request = body.ok ? readGrantRequest(body.data) : null;
    if (!request) {
      return c.json(err("INVALID_CAPABILITY_GRANT", "A valid capability grant request is required."), 400);
    }
    try {
      if (request.resource.type !== "desktop.application") {
        return c.json(err(
          "INVALID_CAPABILITY_GRANT",
          "Generic capability grants must use their resource-specific authorization endpoint.",
        ), 400);
      }
      return c.json(ok(await this.options.getDesktopHost().grantAccess(request)), 201);
    } catch (error) {
      return c.json(err("INVALID_CAPABILITY_GRANT", readErrorMessage(error)), 400);
    }
  };

  readonly revoke = async (c: Context) => {
    const body = await readJson<unknown>(c.req.raw);
    const filter = body.ok ? readGrantFilter(body.data) : null;
    if (
      !filter ||
      !isExactGrantSelector(filter) ||
      filter.resourceType !== "desktop.application"
    ) {
      return c.json(err(
        "INVALID_CAPABILITY_GRANT_FILTER",
        "An exact Desktop subject, resource type, and target selector is required.",
      ), 400);
    }
    return c.json(ok({
      revoked: await this.options.capabilityGrantManager.revoke(filter),
    }));
  };

  readonly getDesktopStatus = async (c: Context) =>
    c.json(ok(await this.options.getDesktopHost().status()));

  readonly getDesktopPermissions = async (c: Context) =>
    c.json(ok(await this.options.getDesktopHost().getPermissions()));

  readonly requestDesktopPermissions = async (c: Context) =>
    c.json(ok(await this.options.getDesktopHost().requestPermissions()));

  readonly openDesktopPermissionSettings = async (c: Context) =>
    c.json(ok(await this.options.getDesktopHost().openPermissionSettings()));

  private readonly listDesktopGrants = async (c: Context) => {
    const filter = readGrantFilterFromQuery(c);
    if (
      filter.resourceType !== undefined &&
      filter.resourceType !== "desktop.application"
    ) {
      return c.json(err(
        "INVALID_CAPABILITY_GRANT_FILTER",
        "Only Desktop capability grants can be listed from this endpoint.",
      ), 400);
    }
    if (
      filter.subject &&
      (!filter.subject.type || !filter.subject.id)
    ) {
      return c.json(err(
        "INVALID_CAPABILITY_GRANT_FILTER",
        "Desktop grant subject filters must include both type and id.",
      ), 400);
    }
    return c.json(ok(await this.options.capabilityGrantManager.list({
      ...filter,
      resourceType: "desktop.application",
    })));
  };
}

function isExactGrantSelector(filter: CapabilityGrantFilter): boolean {
  return Boolean(
    filter.subject?.type &&
    filter.subject.id &&
    filter.resourceType &&
    filter.access?.length &&
    Object.hasOwn(filter, "target") &&
    filter.target !== undefined,
  );
}

function readGrantFilterFromQuery(c: Context): CapabilityGrantFilter {
  const subjectType = readOptionalString(c.req.query("subjectType"));
  const subjectId = readOptionalString(c.req.query("subjectId"));
  const resourceType = readOptionalString(c.req.query("resourceType"));
  return {
    ...(subjectType || subjectId
      ? { subject: { ...(subjectType ? { type: subjectType } : {}), ...(subjectId ? { id: subjectId } : {}) } }
      : {}),
    ...(resourceType ? { resourceType } : {}),
  };
}

function readGrantRequest(value: unknown): CapabilityGrantRequest | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "access",
    "declarationFingerprint",
    "resource",
    "subject",
  ])) return null;
  const subject = readSubject(value.subject, false);
  const resource = isRecord(value.resource) && hasExactKeys(value.resource, ["target", "type"])
    ? value.resource
    : null;
  if (
    !subject || !resource || !readOptionalString(resource.type) ||
    !Array.isArray(value.access) || value.access.length === 0 ||
    !value.access.every((entry) => Boolean(readOptionalString(entry))) ||
    !readOptionalString(value.declarationFingerprint)
  ) return null;
  return {
    subject: { type: subject.type!, id: subject.id! },
    resource: { type: String(resource.type).trim(), target: resource.target },
    access: value.access.map((entry) => String(entry).trim()),
    declarationFingerprint: String(value.declarationFingerprint).trim(),
  };
}

function readGrantFilter(value: unknown): CapabilityGrantFilter | null {
  if (!isRecord(value) || !hasExactKeys(value, ["access", "resourceType", "subject", "target"], true)) {
    return null;
  }
  const subject = value.subject === undefined ? undefined : readSubject(value.subject, true);
  if (value.subject !== undefined && !subject) return null;
  const resourceType = value.resourceType === undefined
    ? undefined
    : readOptionalString(value.resourceType);
  if (value.resourceType !== undefined && !resourceType) return null;
  const access = value.access === undefined
    ? undefined
    : Array.isArray(value.access) &&
        value.access.length > 0 &&
        value.access.every((entry) => Boolean(readOptionalString(entry)))
      ? value.access.map((entry) => String(entry).trim())
      : null;
  if (access === null) return null;
  return {
    ...(subject ? { subject } : {}),
    ...(resourceType ? { resourceType } : {}),
    ...(Object.hasOwn(value, "target") ? { target: value.target } : {}),
    ...(access ? { access } : {}),
  };
}

function readSubject(
  value: unknown,
  partial: boolean,
): { type?: string; id?: string } | null {
  if (!isRecord(value) || !hasExactKeys(value, ["id", "type"], partial)) return null;
  const type = value.type === undefined ? undefined : readOptionalString(value.type);
  const id = value.id === undefined ? undefined : readOptionalString(value.id);
  if ((!partial && (!type || !id)) || (value.type !== undefined && !type) || (value.id !== undefined && !id)) {
    return null;
  }
  return { ...(type ? { type } : {}), ...(id ? { id } : {}) };
}

function hasExactKeys(
  value: Record<string, unknown>,
  allowed: string[],
  allowMissing = false,
): boolean {
  const keys = Object.keys(value);
  return keys.every((key) => allowed.includes(key)) &&
    (allowMissing || keys.length === allowed.length);
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
