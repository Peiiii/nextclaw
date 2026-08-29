import type { Context } from "hono";
import {
  isAppPackageError,
  type AppPackageDependencyBindingInput,
  type AppPackageManager,
} from "@nextclaw/kernel";
import {
  err,
  isRecord,
  ok,
  readJson,
} from "@nextclaw-server/shared/utils/http-response.utils.js";

export class AppPackagesRoutesController {
  constructor(private readonly manager: AppPackageManager) {}

  readonly list = async (c: Context) => c.json(ok(await this.manager.listPackages({
    includeStorageUsage: c.req.query("includeStorageUsage") !== "false",
  })));

  readonly listOperations = async (c: Context) =>
    c.json(ok(await this.manager.listOperations()));

  readonly startInstallOperation = async (c: Context) => {
    const body = await readJson<unknown>(c.req.raw);
    if (!body.ok || !isRecord(body.data) || typeof body.data.source !== "string") {
      return c.json(err("INVALID_APP_PACKAGE_INSTALL", "source is required"), 400);
    }
    try {
      return c.json(ok(await this.manager.startOperation({
        action: "install",
        source: body.data.source,
        registryUrl: typeof body.data.registryUrl === "string"
          ? body.data.registryUrl
          : undefined,
      })), 202);
    } catch (error) {
      return this.handleError(c, error);
    }
  };

  readonly startUpdateOperation = async (c: Context) => {
    const body = await readJson<unknown>(c.req.raw);
    if (!body.ok || !isRecord(body.data)) {
      return c.json(err("INVALID_APP_PACKAGE_UPDATE", "invalid update request"), 400);
    }
    try {
      return c.json(ok(await this.manager.startOperation({
        action: "update",
        appId: c.req.param("appId"),
        version: typeof body.data.version === "string" ? body.data.version : undefined,
        registryUrl: typeof body.data.registryUrl === "string"
          ? body.data.registryUrl
          : undefined,
      })), 202);
    } catch (error) {
      return this.handleError(c, error);
    }
  };

  readonly startRollbackOperation = async (c: Context) => {
    const body = await readJson<unknown>(c.req.raw);
    if (!body.ok || !isRecord(body.data) || typeof body.data.version !== "string") {
      return c.json(err("INVALID_APP_PACKAGE_ROLLBACK", "version is required"), 400);
    }
    try {
      return c.json(ok(await this.manager.startOperation({
        action: "rollback",
        appId: c.req.param("appId"),
        version: body.data.version,
      })), 202);
    } catch (error) {
      return this.handleError(c, error);
    }
  };

  readonly startUninstallOperation = async (c: Context) => {
    const body = await readJson<unknown>(c.req.raw);
    const purgeData = body.ok && isRecord(body.data) && body.data.purgeData === true;
    try {
      return c.json(ok(await this.manager.startOperation({
        action: "uninstall",
        appId: c.req.param("appId"),
        purgeData,
      })), 202);
    } catch (error) {
      return this.handleError(c, error);
    }
  };

  readonly get = async (c: Context) => {
    try {
      return c.json(ok(await this.manager.getPackage(c.req.param("appId"))));
    } catch (error) {
      return this.handleError(c, error);
    }
  };

  readonly inspectDependencies = async (c: Context) => {
    try {
      return c.json(ok(await this.manager.inspectDependencies(c.req.param("appId"))));
    } catch (error) {
      return this.handleError(c, error);
    }
  };

  readonly verifyDependencies = async (c: Context) => {
    try {
      return c.json(ok(await this.manager.verifyDependencies(c.req.param("appId"))));
    } catch (error) {
      return this.handleError(c, error);
    }
  };

  readonly setupDependencies = async (c: Context) => {
    try {
      return c.json(ok(await this.manager.setupDependencies(c.req.param("appId"))));
    } catch (error) {
      return this.handleError(c, error);
    }
  };

  readonly bindDependency = async (c: Context) => {
    const body = await readJson<unknown>(c.req.raw);
    const input = body.ok ? readDependencyBinding(body.data, true) : undefined;
    if (!input) {
      return c.json(err("INVALID_APP_PACKAGE_DEPENDENCY", "binding fields are required"), 400);
    }
    try {
      return c.json(ok(await this.manager.bindDependency(
        c.req.param("appId"),
        input as AppPackageDependencyBindingInput,
      )));
    } catch (error) {
      return this.handleError(c, error);
    }
  };

  readonly unbindDependency = async (c: Context) => {
    const body = await readJson<unknown>(c.req.raw);
    const input = body.ok ? readDependencyBinding(body.data, false) : undefined;
    if (!input) {
      return c.json(err("INVALID_APP_PACKAGE_DEPENDENCY", "binding fields are required"), 400);
    }
    try {
      return c.json(ok(await this.manager.unbindDependency(
        c.req.param("appId"),
        input,
      )));
    } catch (error) {
      return this.handleError(c, error);
    }
  };

  readonly install = async (c: Context) => {
    const body = await readJson<unknown>(c.req.raw);
    if (!body.ok || !isRecord(body.data) || typeof body.data.source !== "string") {
      return c.json(err("INVALID_APP_PACKAGE_INSTALL", "source is required"), 400);
    }
    try {
      return c.json(ok(await this.manager.install(
        body.data.source,
        typeof body.data.registryUrl === "string" ? body.data.registryUrl : undefined,
      )));
    } catch (error) {
      return this.handleError(c, error);
    }
  };

  readonly enable = async (c: Context) => {
    try {
      return c.json(ok(await this.manager.enable(c.req.param("appId"))));
    } catch (error) {
      return this.handleError(c, error);
    }
  };

  readonly disable = async (c: Context) => {
    try {
      return c.json(ok(await this.manager.disable(c.req.param("appId"))));
    } catch (error) {
      return this.handleError(c, error);
    }
  };

  readonly update = async (c: Context) => {
    const body = await readJson<unknown>(c.req.raw);
    if (!body.ok || !isRecord(body.data)) {
      return c.json(err("INVALID_APP_PACKAGE_UPDATE", "invalid update request"), 400);
    }
    try {
      return c.json(ok(await this.manager.update(c.req.param("appId"), {
        version: typeof body.data.version === "string" ? body.data.version : undefined,
        registryUrl: typeof body.data.registryUrl === "string" ? body.data.registryUrl : undefined,
      })));
    } catch (error) {
      return this.handleError(c, error);
    }
  };

  readonly rollback = async (c: Context) => {
    const body = await readJson<unknown>(c.req.raw);
    if (!body.ok || !isRecord(body.data) || typeof body.data.version !== "string") {
      return c.json(err("INVALID_APP_PACKAGE_ROLLBACK", "version is required"), 400);
    }
    try {
      return c.json(ok(await this.manager.rollback(
        c.req.param("appId"),
        body.data.version,
      )));
    } catch (error) {
      return this.handleError(c, error);
    }
  };

  readonly uninstall = async (c: Context) => {
    const body = await readJson<unknown>(c.req.raw);
    const purgeData = body.ok && isRecord(body.data) && body.data.purgeData === true;
    try {
      return c.json(ok(await this.manager.uninstall(c.req.param("appId"), purgeData)));
    } catch (error) {
      return this.handleError(c, error);
    }
  };

  private handleError = (c: Context, error: unknown) => {
    if (isAppPackageError(error)) {
      const status = error.code === "APP_PACKAGE_NOT_FOUND"
        ? 404
        : error.code === "APP_PACKAGE_CONFLICT" || error.code === "APP_PACKAGE_NOT_READY"
          ? 409
          : 400;
      return c.json(err(error.code, error.message), status);
    }
    return c.json(err(
      "APP_PACKAGE_OPERATION_FAILED",
      error instanceof Error ? error.message : String(error),
    ), 400);
  };
}

function readDependencyBinding(
  value: unknown,
  requireProvider: true,
): AppPackageDependencyBindingInput | undefined;
function readDependencyBinding(
  value: unknown,
  requireProvider: false,
): Omit<AppPackageDependencyBindingInput, "providerId"> | undefined;
function readDependencyBinding(
  value: unknown,
  requireProvider: boolean,
): AppPackageDependencyBindingInput | Omit<AppPackageDependencyBindingInput, "providerId"> | undefined {
  if (!isRecord(value) ||
    typeof value.componentId !== "string" || !value.componentId.trim() ||
    !["capability", "resource"].includes(String(value.requirementKind)) ||
    typeof value.requirementId !== "string" || !value.requirementId.trim() ||
    (requireProvider && (typeof value.providerId !== "string" || !value.providerId.trim()))) {
    return undefined;
  }
  return {
    componentId: value.componentId,
    requirementKind: value.requirementKind as "capability" | "resource",
    requirementId: value.requirementId,
    ...(requireProvider ? { providerId: value.providerId as string } : {}),
  };
}
