import { DisposableStore } from "@nextclaw/core";
import type { NextclawExtensionRegistry } from "../plugins.js";
import type { UiNcpRuntimeRegistry } from "./ui-ncp-runtime-registry.js";

function buildPluginRuntimeSnapshotKey(extensionRegistry?: NextclawExtensionRegistry): string {
  const registrations = extensionRegistry?.ncpAgentRuntimes ?? [];
  return registrations
    .map((registration) => [
      registration.pluginId,
      registration.kind,
      registration.label,
      registration.source,
    ].join(":"))
    .join("|");
}

function createRuntimeFactory(
  registration: NextclawExtensionRegistry["ncpAgentRuntimes"][number],
): NextclawExtensionRegistry["ncpAgentRuntimes"][number]["createRuntime"] {
  if (registration.kind !== "codex") {
    return registration.createRuntime;
  }
  return (runtimeParams) =>
    registration.createRuntime({
      ...runtimeParams,
      sessionMetadata: {
        ...runtimeParams.sessionMetadata,
        session_type: "codex",
        codex_runtime_backend: "codex-sdk",
      },
      setSessionMetadata: (nextMetadata) => {
        runtimeParams.setSessionMetadata({
          ...nextMetadata,
          session_type: "codex",
          codex_runtime_backend: "codex-sdk",
        });
      },
    });
}

export class PluginRuntimeRegistrationController {
  private readonly pluginRuntimeScopes = new Map<string, DisposableStore>();
  private pluginRuntimeSnapshotKey = "";
  private activeExtensionRegistry: NextclawExtensionRegistry | undefined;

  constructor(
    private readonly runtimeRegistry: UiNcpRuntimeRegistry,
    private readonly getExtensionRegistry?: () => NextclawExtensionRegistry | undefined,
  ) {}

  refreshPluginRuntimeRegistrations = (): void => {
    this.syncPluginRuntimeRegistrations(this.resolveActiveExtensionRegistry());
  };

  applyExtensionRegistry = (extensionRegistry?: NextclawExtensionRegistry): void => {
    this.activeExtensionRegistry = extensionRegistry;
    this.syncPluginRuntimeRegistrations(extensionRegistry);
  };

  dispose = (): void => {
    for (const scope of this.pluginRuntimeScopes.values()) {
      scope.dispose();
    }
    this.pluginRuntimeScopes.clear();
    this.activeExtensionRegistry = undefined;
    this.pluginRuntimeSnapshotKey = "";
  };

  private syncPluginRuntimeRegistrations = (extensionRegistry?: NextclawExtensionRegistry): void => {
    const nextSnapshotKey = buildPluginRuntimeSnapshotKey(extensionRegistry);
    if (nextSnapshotKey === this.pluginRuntimeSnapshotKey) {
      return;
    }

    this.pluginRuntimeSnapshotKey = nextSnapshotKey;
    for (const scope of this.pluginRuntimeScopes.values()) {
      scope.dispose();
    }
    this.pluginRuntimeScopes.clear();

    for (const registration of extensionRegistry?.ncpAgentRuntimes ?? []) {
      const pluginId = registration.pluginId.trim() || registration.kind;
      const scope = this.pluginRuntimeScopes.get(pluginId) ?? new DisposableStore();
      this.pluginRuntimeScopes.set(pluginId, scope);
      scope.add(this.runtimeRegistry.register({
        kind: registration.kind,
        label: registration.label,
        createRuntime: createRuntimeFactory(registration),
        describeSessionType: registration.describeSessionType,
      }));
    }
  };

  private resolveActiveExtensionRegistry = (): NextclawExtensionRegistry | undefined =>
    this.activeExtensionRegistry ?? this.getExtensionRegistry?.();
}
