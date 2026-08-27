import type {
  CapabilityGrantManager,
  CapabilityGrantRequest,
} from "@kernel/features/capability-grants/index.js";
import {
  createCapabilityDeclarationFingerprint,
  getCapabilityGrantKey,
  matchesCapabilityGrantFilter,
  normalizeCapabilityGrantRequest,
} from "@kernel/features/capability-grants/index.js";
import {
  createDesktopHostError,
  type DesktopHost,
} from "@kernel/features/desktop-host/services/desktop-host.service.js";
import type {
  DesktopApplicationTarget,
  DesktopHostAccess,
  DesktopHostCaller,
  DesktopHostManifest,
  DesktopHostMethod,
  DesktopHostStatus,
  ResolvedDesktopApplicationTarget,
} from "@kernel/features/desktop-host/types/desktop-host.types.js";

const METHOD_ACCESS: Partial<Record<DesktopHostMethod, DesktopHostAccess>> = {
  "host.ui.snapshot": "ui.read",
  "host.ui.observe": "ui.observe",
  "host.ui.unobserve": "ui.observe",
  "host.ui.action": "ui.write",
  "host.screen.captureWindow": "screen.capture-window",
  "host.input.click": "input.pointer",
  "host.input.typeText": "input.keyboard",
  "host.input.pressKey": "input.keyboard",
};

const METHOD_ACCESS_VALUES = new Set<DesktopHostAccess>(
  Object.values(METHOD_ACCESS).filter(
    (access): access is DesktopHostAccess => Boolean(access),
  ),
);

const AGENT_DESKTOP_CAPABILITY_CONTRACT_VERSION = 1;

export class DesktopHostCapabilityManager {
  private readonly watches = new Map<string, {
    extensionId: string;
    generation: string;
    target: ResolvedDesktopApplicationTarget;
    subscriptionId?: string;
  }>();
  private readonly removeEventListener: () => void;
  private readonly removeGrantListener: () => void;
  private readonly removeRevocationListener: () => void;

  constructor(private readonly options: {
    capabilityGrantManager: CapabilityGrantManager;
    host: DesktopHost;
    findManifest: (extensionId: string) => DesktopHostManifest;
    hasAgent?: (agentId: string) => boolean;
    onAuthorizationRequired?: (input: {
      applicationId: string;
      caller: DesktopHostCaller;
      request: CapabilityGrantRequest;
    }) => void;
    onEvent?: (input: {
      extensionId: string;
      generation: string;
      watchId: string;
      event: unknown;
    }) => void;
    onObservationAuthorizationRevoked?: (input: {
      extensionId: string;
      subscriptionId: string;
    }) => Promise<void>;
    onObservationAuthorizationGranted?: (input: {
      extensionId: string;
    }) => Promise<void>;
  }) {
    this.removeEventListener = options.host.onEvent((event) => {
      const watch = this.watches.get(event.watchId);
      if (!watch) return;
      options.onEvent?.({
        extensionId: watch.extensionId,
        generation: watch.generation,
        watchId: event.watchId,
        event: event.event,
      });
    });
    this.removeRevocationListener = options.capabilityGrantManager.onRevoked(async (grants) => {
      for (const [watchId, watch] of this.watches) {
        const revoked = grants.some((grant) =>
          grant.resource.type === "desktop.application" &&
          grant.access.includes("ui.observe") &&
          matchesCapabilityGrantFilter(grant, {
            subject: { type: "extension", id: watch.extensionId },
            resourceType: "desktop.application",
            target: watch.target,
          })
        );
        if (!revoked) continue;
        await this.removeWatch(watchId, watch);
        if (watch.subscriptionId) {
          await options.onObservationAuthorizationRevoked?.({
            extensionId: watch.extensionId,
            subscriptionId: watch.subscriptionId,
          });
        }
      }
    });
    this.removeGrantListener = options.capabilityGrantManager.onGranted(async (grants) => {
      const extensionIds = new Set(
        grants
          .filter((grant) =>
            grant.subject.type === "extension" &&
            grant.resource.type === "desktop.application" &&
            grant.access.includes("ui.observe")
          )
          .map((grant) => grant.subject.id),
      );
      await Promise.all([...extensionIds].map(async (extensionId) =>
        await options.onObservationAuthorizationGranted?.({ extensionId })));
    });
  }

  status = async (): Promise<DesktopHostStatus> => await this.options.host.status();

  getPermissions = async (): Promise<DesktopHostStatus["permissions"]> =>
    await this.options.host.invoke("host.permissions.get", {}, {});

  requestPermissions = async (): Promise<DesktopHostStatus["permissions"]> =>
    await this.options.host.invoke("host.permissions.request", {}, {});

  openPermissionSettings = async (): Promise<{ opened: boolean }> =>
    await this.options.host.invoke("host.permissions.openSettings", {}, {});

  grantAccess = async (request: CapabilityGrantRequest) => {
    const validated = await this.validateGrantRequest(request);
    return await this.options.capabilityGrantManager.grant(validated);
  };

  invoke = async <T>(input: {
    extensionId: string;
    generation: string;
    method: DesktopHostMethod;
    payload: Record<string, unknown>;
    caller?: Omit<DesktopHostCaller, "extensionId">;
  }): Promise<T> => {
    const extensionId = requireString(input.extensionId, "extensionId");
    const generation = requireString(input.generation, "generation");
    const declaration = this.options.findManifest(extensionId).contributes?.hostCapabilities?.desktopAutomation;
    const access = METHOD_ACCESS[input.method];
    if (!access) {
      return await this.invokeUnscopedExtensionMethod<T>({
        extensionId,
        method: input.method,
        payload: input.payload,
        caller: input.caller,
        declared: Boolean(declaration),
      });
    }
    if (!declaration?.access.includes(access)) {
      throw createDesktopHostError({
        code: "capability_not_declared",
        message: `Extension ${extensionId} did not declare Desktop access ${access}.`,
      });
    }
    const caller = { ...input.caller, extensionId };
    if (input.method === "host.ui.unobserve") {
      const watchId = requireString(
        typeof input.payload.watchId === "string" ? input.payload.watchId : "",
        "watchId",
      );
      const watch = this.watches.get(watchId);
      if (
        !watch ||
        watch.extensionId !== extensionId ||
        watch.generation !== generation
      ) {
        throw createDesktopHostError({
          code: "stale_target",
          message: `Desktop watch is unavailable: ${watchId}.`,
        });
      }
      await this.requireGrant(
        extensionId,
        access,
        watch.target,
        watch.target.applicationId,
        caller,
      );
      const result = await this.options.host.invoke<T>(
        input.method,
        { watchId },
        caller,
      );
      this.watches.delete(watchId);
      return result;
    }
    const target = readTarget(input.payload.target);
    const resolvedTarget = await this.options.host.invoke<ResolvedDesktopApplicationTarget>(
      "host.application.resolve",
      { target },
      caller,
    );
    await this.requireGrant(
      extensionId,
      access,
      resolvedTarget,
      target.applicationId,
      caller,
    );
    const result = await this.options.host.invoke<T>(input.method, {
      ...input.payload,
      target: resolvedTarget,
    }, caller);
    const watchId = readWatchId(result);
    if (input.method === "host.ui.observe" && watchId) {
      const subscriptionId = input.caller?.subscriptionId?.trim() || undefined;
      this.watches.set(watchId, {
        extensionId,
        generation,
        target: resolvedTarget,
        ...(subscriptionId ? { subscriptionId } : {}),
      });
    }
    return result;
  };

  private invokeUnscopedExtensionMethod = async <T>(input: {
    extensionId: string;
    method: DesktopHostMethod;
    payload: Record<string, unknown>;
    caller?: Omit<DesktopHostCaller, "extensionId">;
    declared: boolean;
  }): Promise<T> => {
    if (input.method === "host.status") {
      return await this.options.host.invoke<T>(input.method, input.payload, {
        ...input.caller,
        extensionId: input.extensionId,
      });
    }
    if (input.method.startsWith("host.permissions.")) {
      if (!input.declared) {
        throw createDesktopHostError({
          code: "capability_not_declared",
          message: `Extension ${input.extensionId} did not declare Desktop automation.`,
        });
      }
      return await this.options.host.invoke<T>(input.method, input.payload, {
        ...input.caller,
        extensionId: input.extensionId,
      });
    }
    throw createDesktopHostError({
      code: "operation_not_supported",
      message: `Desktop host method is not exposed to extensions: ${input.method}`,
    });
  };

  invokeAgent = async <T>(input: {
    agentId: string;
    sessionId: string;
    agentRunId?: string;
    source?: "legacy-tool" | "desktop";
    method: "host.status" | "host.ui.snapshot" | "host.screen.captureWindow" | "host.ui.action" | "host.input.click" | "host.input.typeText" | "host.input.pressKey";
    payload: Record<string, unknown>;
  }): Promise<T> => {
    const agentId = requireString(input.agentId, "agentId");
    const sessionId = requireString(input.sessionId, "sessionId");
    this.requireKnownAgent(agentId);
    const caller: DesktopHostCaller = {
      agentId,
      sessionId,
      ...(input.agentRunId?.trim()
        ? { agentRunId: input.agentRunId.trim() }
        : {}),
    };
    if (input.method === "host.status") {
      return await this.options.host.invoke<T>(input.method, {}, caller);
    }
    const access = METHOD_ACCESS[input.method];
    if (access !== "ui.read" && access !== "screen.capture-window" && access !== "ui.write" && access !== "input.pointer" && access !== "input.keyboard") {
      throw createDesktopHostError({
        code: "operation_not_supported",
        message: `Desktop host method is not exposed to agents: ${input.method}`,
      });
    }
    if (input.method === "host.ui.action") {
      assertAgentAction(input.payload, input.source ?? "legacy-tool");
    }
    const target = readTarget(input.payload.target);
    const resolvedTarget = await this.options.host.invoke<ResolvedDesktopApplicationTarget>(
      "host.application.resolve",
      { target },
      caller,
    );
    await this.requireAgentGrant(
      agentId,
      access,
      resolvedTarget,
      target.applicationId,
      caller,
    );
    return await this.options.host.invoke<T>(input.method, {
      ...input.payload,
      target: resolvedTarget,
    }, caller);
  };

  releaseExtensionWatches = async (
    extensionId: string,
    generation?: string,
  ): Promise<void> => {
    const removals: Promise<void>[] = [];
    for (const [watchId, watch] of this.watches) {
      if (watch.extensionId !== extensionId) continue;
      if (generation && watch.generation !== generation) continue;
      removals.push(this.removeWatch(watchId, watch));
    }
    await Promise.all(removals);
  };

  private validateGrantRequest = async (
    request: CapabilityGrantRequest,
  ): Promise<CapabilityGrantRequest> => {
    const normalized = normalizeCapabilityGrantRequest(request);
    if (
      (normalized.subject.type !== "extension" &&
        normalized.subject.type !== "agent") ||
      normalized.resource.type !== "desktop.application" ||
      normalized.access.length !== 1
    ) {
      throw new Error("Desktop capability grant request is invalid.");
    }
    const access = normalized.access[0] as DesktopHostAccess;
    if (!METHOD_ACCESS_VALUES.has(access)) {
      throw new Error(`Desktop capability access is unsupported: ${access}`);
    }
    if (normalized.subject.type === "agent") {
      this.requireKnownAgent(normalized.subject.id);
      if (access !== "ui.read" && access !== "screen.capture-window" && access !== "ui.write" && access !== "input.pointer" && access !== "input.keyboard") {
        throw new Error(`Agent Desktop capability does not expose ${access}.`);
      }
    } else {
      const declaration = this.options.findManifest(normalized.subject.id)
        .contributes?.hostCapabilities?.desktopAutomation;
      if (!declaration?.access.includes(access)) {
        throw new Error(
          `Extension ${normalized.subject.id} did not declare Desktop access ${access}.`,
        );
      }
    }
    const target = readResolvedTarget(normalized.resource.target);
    const resolvedTarget = await this.options.host.invoke<ResolvedDesktopApplicationTarget>(
      "host.application.resolve",
      { target: { applicationId: target.applicationId } },
      normalized.subject.type === "extension"
        ? { extensionId: normalized.subject.id }
        : { agentId: normalized.subject.id },
    );
    const expected = normalized.subject.type === "extension"
      ? createDesktopGrantRequest(normalized.subject.id, access, resolvedTarget)
      : createAgentDesktopGrantRequest(normalized.subject.id, access, resolvedTarget);
    if (getCapabilityGrantKey(normalized) !== getCapabilityGrantKey(expected)) {
      throw new Error("Desktop capability grant request is stale or untrusted.");
    }
    return expected;
  };

  private removeWatch = async (
    watchId: string,
    watch: { extensionId: string; generation: string },
  ): Promise<void> => {
    this.watches.delete(watchId);
    await this.options.host.invoke(
      "host.ui.unobserve",
      { watchId },
      { extensionId: watch.extensionId },
    ).catch(() => undefined);
  };

  private requireGrant = async (
    extensionId: string,
    access: DesktopHostAccess,
    target: ResolvedDesktopApplicationTarget,
    applicationId: string,
    caller: DesktopHostCaller,
  ): Promise<void> => {
    const request = createDesktopGrantRequest(extensionId, access, target);
    const decision = await this.options.capabilityGrantManager.check(request);
    if (decision.granted) return;
    this.options.onAuthorizationRequired?.({ applicationId, caller, request });
    throw createDesktopHostError({
      code: "authorization_required",
      message: `Extension ${extensionId} requires authorization for ${applicationId}.`,
      recovery: { action: "show_authorization" },
      request,
    });
  };

  private requireAgentGrant = async (
    agentId: string,
    access: DesktopHostAccess,
    target: ResolvedDesktopApplicationTarget,
    applicationId: string,
    caller: DesktopHostCaller,
  ): Promise<void> => {
    const request = createAgentDesktopGrantRequest(agentId, access, target);
    const decision = await this.options.capabilityGrantManager.check(request);
    if (decision.granted) return;
    this.options.onAuthorizationRequired?.({ applicationId, caller, request });
    throw createDesktopHostError({
      code: "authorization_required",
      message: `Agent ${agentId} requires authorization for ${applicationId}.`,
      recovery: { action: "show_authorization" },
      request,
    });
  };

  private requireKnownAgent = (agentId: string): void => {
    if (!this.options.hasAgent?.(agentId)) {
      throw createDesktopHostError({
        code: "authorization_denied",
        message: `Desktop capability caller is not a registered Agent: ${agentId}.`,
      });
    }
  };

  stop = async (): Promise<void> => {
    await this.releaseAllWatches();
  };

  dispose = async (): Promise<void> => {
    await this.releaseAllWatches();
    this.removeEventListener();
    this.removeGrantListener();
    this.removeRevocationListener();
  };

  private releaseAllWatches = async (): Promise<void> => {
    await Promise.all([...this.watches].map(async ([watchId, watch]) =>
      await this.removeWatch(watchId, watch)));
  };
}

function readTarget(value: unknown): DesktopApplicationTarget {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Desktop target is required.");
  }
  return { applicationId: requireString((value as { applicationId?: string }).applicationId ?? "", "target.applicationId") };
}

function readResolvedTarget(value: unknown): ResolvedDesktopApplicationTarget {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Desktop capability target is invalid.");
  }
  const target = value as Record<string, unknown>;
  const applicationId = requireString(
    typeof target.applicationId === "string" ? target.applicationId : "",
    "resource.target.applicationId",
  );
  if (target.platform === "darwin") {
    return {
      platform: "darwin",
      applicationId,
      bundleId: requireString(
        typeof target.bundleId === "string" ? target.bundleId : "",
        "resource.target.bundleId",
      ),
    };
  }
  if (target.platform === "win32") {
    return {
      platform: "win32",
      applicationId,
      ...(typeof target.appUserModelId === "string"
        ? { appUserModelId: requireString(target.appUserModelId, "resource.target.appUserModelId") }
        : {}),
      ...(typeof target.executableIdentity === "string"
        ? { executableIdentity: requireString(target.executableIdentity, "resource.target.executableIdentity") }
        : {}),
    };
  }
  if (target.platform === "linux") {
    return {
      platform: "linux",
      applicationId,
      ...(typeof target.desktopFileId === "string"
        ? { desktopFileId: requireString(target.desktopFileId, "resource.target.desktopFileId") }
        : {}),
      ...(typeof target.executableIdentity === "string"
        ? { executableIdentity: requireString(target.executableIdentity, "resource.target.executableIdentity") }
        : {}),
    };
  }
  throw new Error("Desktop capability target platform is invalid.");
}

function createDesktopGrantRequest(
  extensionId: string,
  access: DesktopHostAccess,
  target: ResolvedDesktopApplicationTarget,
): CapabilityGrantRequest {
  return {
    subject: { type: "extension", id: extensionId },
    resource: { type: "desktop.application", target },
    access: [access],
    declarationFingerprint: createCapabilityDeclarationFingerprint({ access }),
  };
}

function createAgentDesktopGrantRequest(
  agentId: string,
  access: DesktopHostAccess,
  target: ResolvedDesktopApplicationTarget,
): CapabilityGrantRequest {
  return {
    subject: { type: "agent", id: agentId },
    resource: { type: "desktop.application", target },
    access: [access],
    declarationFingerprint: createCapabilityDeclarationFingerprint({
      contractVersion: AGENT_DESKTOP_CAPABILITY_CONTRACT_VERSION,
      access,
    }),
  };
}

function assertAgentAction(payload: Record<string, unknown>, source: "legacy-tool" | "desktop"): void {
  const action = payload.action;
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw createDesktopHostError({
      code: "operation_not_supported",
      message: "Agent Desktop action must be a supported atomic action.",
    });
  }
  const candidate = action as Record<string, unknown>;
  const isDraft = candidate.type === "setValue" && typeof candidate.value === "string";
  const isDesktopPress = source === "desktop" && candidate.type === "press";
  if (!isDraft && !isDesktopPress) {
    throw createDesktopHostError({
      code: "operation_not_supported",
      message: "Agent Desktop action only supports setValue; the Desktop SDK may additionally press an accessibility element.",
    });
  }
}

function readWatchId(value: unknown): string | null {
  return value && typeof value === "object" && !Array.isArray(value) &&
      typeof (value as { watchId?: unknown }).watchId === "string"
    ? (value as { watchId: string }).watchId
    : null;
}

function requireString(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required.`);
  return normalized;
}
