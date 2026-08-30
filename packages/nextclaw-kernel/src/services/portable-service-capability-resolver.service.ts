import { createHash } from "node:crypto";
import { mkdir, realpath, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  AppHomeService,
  AppRegistryService,
  type AppDocumentAccessScope,
} from "@nextclaw/app-runtime";
import { resolveSecretRef, type Config } from "@nextclaw/core";
import {
  PortableServiceRunnerError,
  type PortableRunnerApp,
  type PortableRunnerFileMount,
} from "@kernel/services/portable-service-runner-client.service.js";
import type { ServiceAppRecord } from "@kernel/types/service-app.types.js";

type ResolvedPortableCapabilitySnapshot = {
  fileMounts: PortableRunnerFileMount[];
  secretVariables: Record<string, string>;
  secretFingerprints: Record<string, string>;
};

export class PortableServiceCapabilityResolverService {
  private readonly registryService?: AppRegistryService;

  constructor(private readonly params: {
    appHomeDirectory?: string;
    getSecretConfig?: () => Config;
    secretConfigPath?: string;
  }) {
    if (params.appHomeDirectory) {
      this.registryService = new AppRegistryService(new AppHomeService(params.appHomeDirectory));
    }
  }

  resolveRunnerApp = async (params: {
    app: ServiceAppRecord;
    providerIds?: string[];
    previous?: PortableRunnerApp;
    stopChangedLane: (previous: PortableRunnerApp) => Promise<void>;
  }): Promise<PortableRunnerApp> => {
    const { app, providerIds, previous, stopChangedLane } = params;
    if (!app.componentPath || !app.dataDirectory) {
      throw new Error(`Portable Service App ${app.id} is missing component or data storage.`);
    }
    let snapshot: ResolvedPortableCapabilitySnapshot;
    try {
      snapshot = await this.resolveCapabilitySnapshot(app);
    } catch (error) {
      if (previous) await stopChangedLane(previous);
      throw error;
    }
    const next: PortableRunnerApp = {
      id: app.id, componentPath: app.componentPath, dataDirectory: app.dataDirectory,
      permissions: app.permissions ?? {}, fileMounts: snapshot.fileMounts,
      secretVariables: snapshot.secretVariables, secretFingerprints: snapshot.secretFingerprints,
      providerIds,
    };
    if (previous && this.fingerprint(previous) !== this.fingerprint(next)) {
      await stopChangedLane(previous);
    }
    return next;
  };

  private resolveCapabilitySnapshot = async (app: ServiceAppRecord): Promise<ResolvedPortableCapabilitySnapshot> => {
    const fileMounts: PortableRunnerFileMount[] = [];
    const assetDirectory = app.packageDirectory ? await this.resolveDirectoryIfPresent(join(app.packageDirectory, "assets")) : undefined;
    if (assetDirectory) fileMounts.push({ hostPath: assetDirectory, guestPath: "/app", writable: false });
    const privateDirectories: Array<[string, string]> = [
      [app.dataDirectory!, "/data"],
      ...(app.storage ? [[app.storage.cacheDirectory, "/cache"] as [string, string], [app.storage.temporaryDirectory, "/tmp"] as [string, string]] : []),
    ];
    for (const [hostPath, guestPath] of privateDirectories) {
      fileMounts.push({ hostPath: await this.materializePrivateDirectory(hostPath, app.id), guestPath, writable: true });
    }
    for (const grant of await this.resolveDocumentGrants(app)) {
      fileMounts.push({ hostPath: grant.hostPath, guestPath: `/documents/${encodeScopeId(grant.scope.id)}`, writable: grant.scope.mode === "read-write" });
    }
    const guestPaths = new Set<string>();
    for (const mount of fileMounts) {
      if (guestPaths.has(mount.guestPath)) throw new Error(`Portable filesystem guest path is duplicated: ${mount.guestPath}`);
      guestPaths.add(mount.guestPath);
    }
    return { fileMounts, ...(await this.resolveSecretVariables(app)) };
  };

  private resolveSecretVariables = async (app: ServiceAppRecord): Promise<Pick<ResolvedPortableCapabilitySnapshot, "secretVariables" | "secretFingerprints">> => {
    const declared = app.permissions?.secrets ?? [];
    if (declared.length === 0) return { secretVariables: {}, secretFingerprints: {} };
    if (!app.packageId || !this.registryService) return this.missingRegistrySecrets(declared);
    const record = await this.registryService.getApp(app.packageId);
    if (!record || (app.packageVersion && record.activeVersion !== app.packageVersion)) return this.missingRegistrySecrets(declared);
    const config = this.params.getSecretConfig?.();
    const secretVariables: Record<string, string> = {};
    const secretFingerprints: Record<string, string> = {};
    for (const slot of declared) {
      const binding = record.secretBindings[slot.id];
      if (!binding) {
        if (slot.required) this.throwSecretError("SECRET_BINDING_MISSING", slot.id);
        continue;
      }
      if (!config) this.throwSecretError("SECRET_RESOLUTION_FAILED", slot.id);
      try {
        const value = resolveSecretRef(config!, binding, { configPath: this.params.secretConfigPath });
        secretVariables[spinSecretVariableName(slot.id)] = value;
        secretFingerprints[slot.id] = createHash("sha256").update(slot.id).update("\u0000").update(value).digest("hex");
      } catch {
        this.throwSecretError("SECRET_RESOLUTION_FAILED", slot.id);
      }
    }
    return { secretVariables, secretFingerprints };
  };

  private missingRegistrySecrets = (declared: NonNullable<ServiceAppRecord["permissions"]>["secrets"] = []) => {
    const required = declared?.find((slot) => slot.required);
    if (required) this.throwSecretError("SECRET_BINDING_MISSING", required.id);
    return { secretVariables: {}, secretFingerprints: {} };
  };

  private throwSecretError = (code: "SECRET_BINDING_MISSING" | "SECRET_RESOLUTION_FAILED", slotId: string): never => {
    throw new PortableServiceRunnerError(code, `${code}: secret slot ${slotId} is unavailable.`);
  };

  private resolveDocumentGrants = async (app: ServiceAppRecord): Promise<Array<{ scope: AppDocumentAccessScope; hostPath: string }>> => {
    const scopes = app.permissions?.documentAccess ?? [];
    if (scopes.length === 0 || !app.packageId || !this.registryService) return [];
    const record = await this.registryService.getApp(app.packageId);
    if (!record || (app.packageVersion && record.activeVersion !== app.packageVersion)) return [];
    const resolved: Array<{ scope: AppDocumentAccessScope; hostPath: string }> = [];
    for (const scope of scopes) {
      const grantedPath = record.grants[scope.id];
      if (grantedPath) resolved.push({ scope, hostPath: await this.requireCanonicalDirectory(grantedPath, `${app.id}:${scope.id}`) });
    }
    return resolved;
  };

  private resolveDirectoryIfPresent = async (directoryPath: string): Promise<string | undefined> => {
    try { return await this.requireCanonicalDirectory(directoryPath, directoryPath); }
    catch (error) { if (isMissingPathError(error)) return undefined; throw error; }
  };

  private requireCanonicalDirectory = async (directoryPath: string, label: string): Promise<string> => {
    const canonicalPath = await realpath(directoryPath);
    if (!(await stat(canonicalPath)).isDirectory()) throw new Error(`Portable filesystem mount is not a directory: ${label}`);
    return canonicalPath;
  };

  private materializePrivateDirectory = async (directoryPath: string, label: string): Promise<string> => {
    await mkdir(directoryPath, { recursive: true });
    return await this.requireCanonicalDirectory(directoryPath, label);
  };

  private fingerprint = (app: PortableRunnerApp): string => JSON.stringify({
    componentPath: app.componentPath, dataDirectory: app.dataDirectory, permissions: app.permissions,
    fileMounts: app.fileMounts, secretFingerprints: app.secretFingerprints, providerIds: app.providerIds ?? [],
  });
}

function encodeScopeId(scopeId: string): string {
  const encoded = encodeURIComponent(scopeId);
  if (!scopeId.trim() || encoded === "." || encoded === "..") throw new Error(`Portable document scope is unsafe: ${scopeId}`);
  return encoded;
}

function spinSecretVariableName(slotId: string): string {
  return `nextclaw_secret_${Buffer.from(slotId, "utf8").toString("hex")}`;
}

function isMissingPathError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
