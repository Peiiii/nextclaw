import type { Context } from "hono";
import {
  isSystemObjectReferenceError,
  type SystemObjectReferenceManager,
} from "@nextclaw/kernel";
import {
  SYSTEM_OBJECT_REFERENCE_MAX_LIMIT,
  type SystemObjectReferenceResolveRequest,
} from "@nextclaw/shared";
import {
  err,
  isRecord,
  ok,
  readJson,
} from "@nextclaw-server/shared/utils/http-response.utils.js";

function readLimit(value: string | undefined): number | undefined | null {
  if (value === undefined) return undefined;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= SYSTEM_OBJECT_REFERENCE_MAX_LIMIT
    ? limit
    : null;
}

export class SystemObjectReferencesRoutesController {
  constructor(private readonly manager: SystemObjectReferenceManager) {}

  readonly list = async (c: Context) => {
    const limit = readLimit(c.req.query("limit"));
    if (limit === null) {
      return c.json(
        err("INVALID_SYSTEM_OBJECT_QUERY", `limit must be between 1 and ${SYSTEM_OBJECT_REFERENCE_MAX_LIMIT}`),
        400,
      );
    }
    try {
      return c.json(ok(await this.manager.listReferences({
        query: c.req.query("query"),
        limit,
        objectType: c.req.query("objectType"),
      })));
    } catch (error) {
      if (!isSystemObjectReferenceError(error)) throw error;
      return c.json(err(error.code, error.message), 400);
    }
  };

  readonly resolve = async (c: Context) => {
    const body = await readJson<SystemObjectReferenceResolveRequest>(c.req.raw);
    if (!body.ok || !isRecord(body.data) || typeof body.data.uri !== "string" || !body.data.uri.trim()) {
      return c.json(err("INVALID_SYSTEM_OBJECT_REFERENCE", "uri must be a non-empty string"), 400);
    }
    try {
      return c.json(ok(await this.manager.resolveReference(body.data.uri)));
    } catch (error) {
      if (!isSystemObjectReferenceError(error)) throw error;
      const status = error.code === "SYSTEM_OBJECT_NOT_FOUND" ? 404 : 400;
      return c.json(err(error.code, error.message), status);
    }
  };
}
