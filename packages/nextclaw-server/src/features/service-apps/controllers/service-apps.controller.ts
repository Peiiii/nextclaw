import type { Context } from "hono";
import {
  isPanelAppError,
  isServiceAppError,
  type PanelAppManager,
  type PortableRuntimeAcceptanceManager,
  type ServiceAppManager,
} from "@nextclaw/kernel";
import {
  err,
  isRecord,
  ok,
  readJson,
} from "@nextclaw-server/shared/utils/http-response.utils.js";
import type {
  ServiceActionGrantBatchRequestView,
  ServiceActionInvokeRequestView,
} from "@nextclaw-server/shared/types/server-api.types.js";

const PANEL_BRIDGE_SESSION_HEADER = "x-nextclaw-panel-bridge-session";

function statusForServiceAppError(code: string): 400 | 401 | 403 | 404 | 422 | 502 {
  switch (code) {
    case "AUTHORIZATION_REQUIRED":
      return 401;
    case "SERVICE_APP_ACTION_NOT_DECLARED":
      return 403;
    case "SERVICE_APP_ACTION_NOT_FOUND":
    case "SERVICE_APP_NOT_FOUND":
    case "SERVICE_APP_JOB_NOT_FOUND":
    case "SERVICE_APP_RESIDENT_EVENT_NOT_FOUND":
      return 404;
    case "SERVICE_APP_RUNTIME_FAILED":
    case "WASI_ABI_VERSION_MISMATCH":
    case "WASI_COMPONENT_FAILED":
    case "WASI_COMPONENT_TRAP":
    case "WASI_GUEST_EXPORT_MISSING":
      return 502;
    case "WASI_CAPABILITY_DENIED":
      return 403;
    case "WASI_INPUT_SCHEMA_MISMATCH":
      return 422;
    case "STREAM_CURSOR_EXPIRED":
      return 422;
    default:
      return 400;
  }
}
export class ServiceAppsRoutesController {
  constructor(private readonly params: {
    panelAppManager: PanelAppManager;
    serviceAppManager: ServiceAppManager;
    portableRuntimeAcceptance: PortableRuntimeAcceptanceManager;
  }) {}

  readonly listServiceApps = async (c: Context) => {
    return c.json(ok(await this.params.serviceAppManager.listServiceApps()));
  };

  readonly getServiceApp = async (c: Context) => {
    try {
      return c.json(ok(await this.params.serviceAppManager.getServiceApp(c.req.param("appId"))));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly inspectServiceAppAiCapabilities = async (c: Context) => {
    try {
      return c.json(ok(await this.params.serviceAppManager.inspectServiceAppAiCapabilities(c.req.param("appId"))));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly verifyServiceAppAiCapabilities = async (c: Context) => {
    try {
      return c.json(ok(await this.params.serviceAppManager.verifyServiceAppAiCapabilities(c.req.param("appId"))));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly bindServiceAppAiCapability = async (c: Context) => {
    const body = await readJson<{ kind?: unknown; slotId?: unknown; targetId?: unknown }>(c.req.raw);
    if (!body.ok || (body.data?.kind !== "model" && body.data?.kind !== "agent") ||
      typeof body.data.slotId !== "string" || typeof body.data.targetId !== "string") {
      return c.json(err("INVALID_SERVICE_APP_AI_BINDING", "kind, slotId, and targetId are required."), 400);
    }
    try {
      const result = body.data.kind === "model"
        ? await this.params.serviceAppManager.bindServiceAppModelSlot(c.req.param("appId"), body.data.slotId, body.data.targetId)
        : await this.params.serviceAppManager.bindServiceAppAgentSlot(c.req.param("appId"), body.data.slotId, body.data.targetId);
      return c.json(ok(result));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly unbindServiceAppAiCapability = async (c: Context) => {
    const body = await readJson<{ kind?: unknown; slotId?: unknown }>(c.req.raw);
    if (!body.ok || (body.data?.kind !== "model" && body.data?.kind !== "agent") || typeof body.data.slotId !== "string") {
      return c.json(err("INVALID_SERVICE_APP_AI_BINDING", "kind and slotId are required."), 400);
    }
    try {
      return c.json(ok(await this.params.serviceAppManager.unbindServiceAppAiSlot(
        c.req.param("appId"), body.data.kind, body.data.slotId,
      )));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly listServiceActions = async (c: Context) => {
    try {
      const bridgeSession = this.readOptionalBridgeSession(c);
      const appId = c.req.query("appId")?.trim();
      const actions = await this.params.serviceAppManager.listServiceActions(
        bridgeSession
          ? {
              caller: bridgeSession.caller,
              appId,
              declaredActions: bridgeSession.declaredActions,
            }
          : { appId },
      );
      return c.json(ok({ actions }));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly discoverServiceAppActions = async (c: Context) => {
    try {
      const actions = await this.params.serviceAppManager.discoverServiceAppActions(
        c.req.param("appId"),
      );
      return c.json(ok({ actions }));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly invokeServiceAction = async (c: Context) => {
    const body = await readJson<ServiceActionInvokeRequestView>(c.req.raw);
    if (!body.ok || (body.data !== undefined && !isRecord(body.data))) {
      return c.json(err("INVALID_SERVICE_ACTION_REQUEST", "invalid service action request"), 400);
    }
    try {
      const bridgeSession = this.requireBridgeSession(c);
      const payload = await this.params.serviceAppManager.invokeServiceAction(
        c.req.param("actionId"),
        {
          caller: bridgeSession.caller,
          declaredActions: bridgeSession.declaredActions,
          input: isRecord(body.data.input) ? body.data.input : {},
        },
      );
      return c.json(ok(payload));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly invokeInstalledServiceAction = async (c: Context) => {
    const body = await readJson<{ input?: unknown }>(c.req.raw);
    if (!body.ok || (body.data?.input !== undefined && !isRecord(body.data.input))) {
      return c.json(err("INVALID_SERVICE_ACTION_REQUEST", "invalid service action request"), 400);
    }
    try {
      return c.json(ok(await this.params.serviceAppManager.invokeInstalledServiceAction(
        c.req.param("appId"),
        c.req.param("actionName"),
        isRecord(body.data?.input) ? body.data.input : {},
      )));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  /**
   * Agent tool providers call the same manager method. This explicit endpoint
   * is the non-LLM integration/diagnostic surface: it still requires a real
   * configured Agent and its explicit Service Action grant, so it cannot
   * impersonate either a Panel bridge or an arbitrary Agent.
   */
  readonly invokeAgentServiceAction = async (c: Context) => {
    const body = await readJson<{ input?: unknown }>(c.req.raw);
    if (!body.ok || (body.data?.input !== undefined && !isRecord(body.data.input))) {
      return c.json(err("INVALID_SERVICE_ACTION_REQUEST", "invalid service action request"), 400);
    }
    try {
      return c.json(ok(await this.params.serviceAppManager.invokeServiceAction(
        c.req.param("actionId"),
        {
          caller: { surface: "agent", agentId: c.req.param("agentId") },
          input: isRecord(body.data?.input) ? body.data.input : {},
        },
      )));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly listVerificationRecords = async (c: Context) => {
    try {
      return c.json(ok(await this.params.serviceAppManager.listVerificationRecords({
        acceptanceId: this.readOptionalQuery(c, "acceptanceId"),
        appId: this.readOptionalQuery(c, "appId"),
        limit: this.readLimit(c),
      })));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  /** Stable read-only projection of the single portable-runtime acceptance registry. */
  readonly getPortableRuntimeAcceptanceContract = async (c: Context) => {
    try {
      return c.json(ok(this.params.portableRuntimeAcceptance.contract(this.readLocale(c))));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly getPortableRuntimeAcceptanceStatus = async (c: Context) => {
    try {
      return c.json(ok(await this.params.portableRuntimeAcceptance.status({
        appId: this.readOptionalQuery(c, "appId"), locale: this.readLocale(c),
      })));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly exportPortableRuntimeAcceptance = async (c: Context) => {
    try {
      return c.json(ok(await this.params.portableRuntimeAcceptance.export({
        appId: this.readOptionalQuery(c, "appId"), locale: this.readLocale(c),
      })));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly listServiceAppJobs = async (c: Context) => {
    try {
      return c.json(ok(await this.params.serviceAppManager.listServiceAppJobs(c.req.param("appId"))));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly getServiceAppJob = async (c: Context) => {
    try {
      return c.json(ok(await this.params.serviceAppManager.getServiceAppJob(
        c.req.param("appId"), c.req.param("jobId"),
      )));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  /** Cursor replay only; a disconnected client never changes Job execution. */
  readonly watchServiceAppJob = async (c: Context) => {
    const afterSequence = this.readAfterSequence(c);
    if (afterSequence === null) {
      return c.json(err("INVALID_JOB_CURSOR", "afterSequence must be a non-negative integer"), 400);
    }
    try {
      return c.json(ok(await this.params.serviceAppManager.watchServiceAppJob(
        c.req.param("appId"), c.req.param("jobId"), afterSequence,
      )));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly cancelServiceAppJob = async (c: Context) => {
    try {
      return c.json(ok(await this.params.serviceAppManager.cancelServiceAppJob(
        c.req.param("appId"), c.req.param("jobId"),
      )));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  /** Inspect durable Resident delivery facts; payload stays private to the instance journal. */
  readonly listResidentInbox = async (c: Context) => {
    try {
      return c.json(ok(await this.params.serviceAppManager.listResidentInbox(
        c.req.param("appId"),
        { deadLettersOnly: c.req.query("deadLetters") === "true" },
      )));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly replayResidentDeadLetter = async (c: Context) => {
    try {
      return c.json(ok(await this.params.serviceAppManager.replayResidentDeadLetter(
        c.req.param("appId"), c.req.param("eventId"),
      )));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly grantServiceAction = async (c: Context) => {
    try {
      const bridgeSession = this.requireBridgeSession(c);
      const payload = await this.params.serviceAppManager.grantServiceAction(
        c.req.param("actionId"),
        {
          caller: bridgeSession.caller,
          declaredActions: bridgeSession.declaredActions,
        },
      );
      return c.json(ok(payload));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly grantServiceActions = async (c: Context) => {
    const body = await readJson<ServiceActionGrantBatchRequestView>(c.req.raw);
    if (!body.ok || !Array.isArray(body.data?.actionIds)) {
      return c.json(err("INVALID_SERVICE_ACTION_GRANT_REQUEST", "invalid service action grant request"), 400);
    }
    try {
      const bridgeSession = this.requireBridgeSession(c);
      const grants = await this.params.serviceAppManager.grantServiceActions(
        body.data.actionIds,
        {
          caller: bridgeSession.caller,
          declaredActions: bridgeSession.declaredActions,
        },
      );
      return c.json(ok({ grants }));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly grantAgentServiceActions = async (c: Context) => {
    const body = await readJson<ServiceActionGrantBatchRequestView>(c.req.raw);
    const agentId = c.req.param("agentId").trim();
    if (!body.ok || !Array.isArray(body.data?.actionIds) || !agentId) {
      return c.json(err(
        "INVALID_SERVICE_ACTION_GRANT_REQUEST",
        "invalid Agent service action grant request",
      ), 400);
    }
    try {
      const grants = await this.params.serviceAppManager.grantServiceActions(
        body.data.actionIds,
        { caller: { surface: "agent", agentId } },
      );
      return c.json(ok({ grants }));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly listServiceActionGrants = async (c: Context) => {
    return c.json(ok({
      grants: await this.params.serviceAppManager.listServiceActionGrants(),
    }));
  };

  readonly revokeServiceAction = async (c: Context) => {
    try {
      const bridgeSession = this.requireBridgeSession(c);
      await this.params.serviceAppManager.revokeServiceAction(
        bridgeSession.caller,
        c.req.param("actionId"),
      );
      return c.json(ok({ revoked: true }));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly revokeServiceActionGrant = async (c: Context) => {
    const caller = this.readCallerQuery(c);
    if (!caller) {
      return c.json(err("INVALID_SERVICE_ACTION_CALLER", "invalid service action caller"), 400);
    }
    try {
      await this.params.serviceAppManager.revokeServiceAction(
        caller,
        c.req.param("actionId"),
      );
      return c.json(ok({ revoked: true }));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly restartServiceApp = async (c: Context) => {
    try {
      return c.json(ok(await this.params.serviceAppManager.restartServiceApp(c.req.param("appId"))));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly deleteServiceApp = async (c: Context) => {
    const body = await readJson<unknown>(c.req.raw);
    const purgeData = body.ok && isRecord(body.data) && body.data.purgeData === true;
    try {
      return c.json(ok(await this.params.serviceAppManager.deleteServiceApp(
        c.req.param("appId"),
        purgeData,
      )));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  private requireBridgeSession = (c: Context) => {
    const token = c.req.raw.headers.get(PANEL_BRIDGE_SESSION_HEADER)?.trim();
    if (!token) {
      throw new Error("panel app bridge session is required");
    }
    return this.params.panelAppManager.resolvePanelAppBridgeSession(token);
  };

  private readOptionalBridgeSession = (c: Context) => {
    const token = c.req.raw.headers.get(PANEL_BRIDGE_SESSION_HEADER)?.trim();
    return token
      ? this.params.panelAppManager.resolvePanelAppBridgeSession(token)
      : null;
  };

  private readCallerQuery = (c: Context) => {
    const surface = c.req.query("surface");
    const callerId = c.req.query("callerId")?.trim() ?? c.req.query("appId")?.trim();
    if (!callerId) return null;
    if (surface === "panel-app") return { surface, appId: callerId } as const;
    if (surface === "agent") return { surface, agentId: callerId } as const;
    return null;
  };

  private readOptionalQuery = (c: Context, key: string): string | undefined => {
    const value = c.req.query(key)?.trim();
    return value || undefined;
  };

  private readLocale = (c: Context): "zh-CN" | "en" => c.req.query("locale") === "en" ? "en" : "zh-CN";

  private readLimit = (c: Context): number | undefined => {
    const raw = c.req.query("limit");
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : undefined;
  };

  private readAfterSequence = (c: Context): number | undefined | null => {
    const raw = c.req.query("afterSequence");
    if (raw === undefined || raw === "") return undefined;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 0 ? value : null;
  };

  private handleServiceAppError = (c: Context, error: unknown) => {
    if (isServiceAppError(error)) {
      return c.json(
        err(error.code, error.message, error.details),
        statusForServiceAppError(error.code),
      );
    }
    if (isPanelAppError(error)) {
      return c.json(err(error.code, error.message), 404);
    }
    if (error instanceof Error && error.message === "panel app bridge session is required") {
      return c.json(err("PANEL_APP_BRIDGE_SESSION_REQUIRED", error.message), 401);
    }
    return c.json(err("SERVICE_APP_REQUEST_FAILED", "The Service App request failed. Please retry."), 500);
  };
}
