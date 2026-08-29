import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { FileLockService, type AppStorageContext } from "@nextclaw/app-runtime";
import {
  AppPackageError,
  type AppPackageDependencyBinding,
  type AppPackageDependencyBindingInput,
  type AppPackageDependencyCandidate,
  type AppPackageDependencyView,
  type AppPackageReadiness,
  type AppPackageReadinessRequirement,
  type CapabilityProviderView,
} from "@kernel/types/app-package.types.js";
import type { ServiceAppManifest } from "@kernel/types/service-app.types.js";
import { readServiceAppManifest } from "@kernel/utils/service-app-manifest.utils.js";

type DependencyComponent = {
  id: string;
  kind: "panel" | "service";
  componentDirectory: string;
};

export type AppPackageDependencyTarget = {
  appId: string;
  storage: AppStorageContext;
  components: DependencyComponent[];
};

type DependencyRequirement = {
  componentId: string;
  kind: "capability" | "resource";
  id: string;
  title: string;
  description?: string;
  remediation?: AppPackageReadinessRequirement["remediation"];
  capabilityId?: string;
  capabilityVersion?: string;
  resourceType?: string;
};

type DependencyStore = {
  schemaVersion: 1;
  bindings: AppPackageDependencyBinding[];
};

const STORE_FILE_NAME = "dependencies.json";
const LOCK_FILE_NAME = ".dependencies.lock";
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

/**
 * Owns non-sensitive Consumer-to-Provider bindings. The Provider catalog stays
 * outside this service, so activation and runtime ownership remain unchanged.
 */
export class AppPackageDependencyService {
  private readonly fileLockService = new FileLockService();

  inspect = async (params: {
    target: AppPackageDependencyTarget;
    providers: CapabilityProviderView[];
  }): Promise<AppPackageDependencyView> => {
    const [requirements, bindings] = await Promise.all([
      this.readRequirements(params.target.components),
      this.readBindings(params.target.storage),
    ]);
    return this.toView(requirements, bindings, params.providers);
  };

  resolveStoredProviderIds = async (
    target: AppPackageDependencyTarget,
  ): Promise<Record<string, string[]>> => {
    const [requirements, bindings] = await Promise.all([
      this.readRequirements(target.components),
      this.readBindings(target.storage),
    ]);
    const result: Record<string, string[]> = {};
    for (const requirement of requirements) {
      const binding = this.findBinding(bindings, requirement);
      if (!binding) continue;
      const providerIds = result[requirement.componentId] ?? [];
      if (!providerIds.includes(binding.providerId)) providerIds.push(binding.providerId);
      result[requirement.componentId] = providerIds;
    }
    return result;
  };

  listBindings = async (
    target: AppPackageDependencyTarget,
  ): Promise<AppPackageDependencyBinding[]> => await this.readBindings(target.storage);

  setup = async (params: {
    target: AppPackageDependencyTarget;
    providers: CapabilityProviderView[];
  }): Promise<AppPackageDependencyView> => await this.update(params, (requirements, bindings) => {
    const updated = [...bindings];
    for (const requirement of requirements) {
      if (this.findBinding(updated, requirement)) continue;
      const candidates = this.findCandidates(requirement, params.providers);
      if (candidates.length === 1) {
        updated.push(this.toBinding(requirement, candidates[0].providerId));
      }
    }
    return updated;
  });

  bind = async (params: {
    target: AppPackageDependencyTarget;
    providers: CapabilityProviderView[];
    input: AppPackageDependencyBindingInput;
  }): Promise<AppPackageDependencyView> => await this.update(params, (requirements, bindings) => {
    const requirement = this.requireRequirement(requirements, params.input);
    const provider = params.providers.find((entry) => entry.providerId === params.input.providerId);
    if (!provider || !this.providerMatches(requirement, provider)) {
      throw new AppPackageError(
        "APP_PACKAGE_NOT_READY",
        `Provider ${params.input.providerId} cannot satisfy ${this.requirementKey(requirement)}.`,
      );
    }
    return [
      ...bindings.filter((entry) => !this.isBindingForRequirement(entry, requirement)),
      this.toBinding(requirement, provider.providerId),
    ];
  });

  unbind = async (params: {
    target: AppPackageDependencyTarget;
    providers: CapabilityProviderView[];
    input: Omit<AppPackageDependencyBindingInput, "providerId">;
  }): Promise<AppPackageDependencyView> => await this.update(params, (requirements, bindings) => {
    const requirement = this.requireRequirement(requirements, params.input);
    return bindings.filter((entry) => !this.isBindingForRequirement(entry, requirement));
  });

  private update = async (
    params: { target: AppPackageDependencyTarget; providers: CapabilityProviderView[] },
    mutate: (
      requirements: DependencyRequirement[],
      bindings: AppPackageDependencyBinding[],
    ) => AppPackageDependencyBinding[],
  ): Promise<AppPackageDependencyView> => await this.fileLockService.withLock(
    this.lockPath(params.target.storage),
    async () => {
      const [requirements, bindings] = await Promise.all([
        this.readRequirements(params.target.components),
        this.readBindings(params.target.storage),
      ]);
      const updated = this.normalizeBindings(mutate(requirements, bindings));
      await this.writeBindings(params.target.storage, updated);
      return this.toView(requirements, updated, params.providers);
    },
  );

  private readRequirements = async (
    components: DependencyComponent[],
  ): Promise<DependencyRequirement[]> => (await Promise.all(components
    .filter((component) => component.kind === "service")
    .map(async (component) => this.readComponentRequirements(component)))).flat();

  private readComponentRequirements = async (
    component: DependencyComponent,
  ): Promise<DependencyRequirement[]> => {
    const manifest = await readServiceAppManifest(component.componentDirectory);
    return this.toRequirements(component.id, manifest);
  };

  private toRequirements = (
    componentId: string,
    manifest: ServiceAppManifest,
  ): DependencyRequirement[] => [
    ...(manifest.requires?.capabilities ?? []).map((requirement) => ({
      componentId,
      kind: "capability" as const,
      id: requirement.version ? `${requirement.id}@${requirement.version}` : requirement.id,
      title: requirement.title ?? requirement.id,
      description: requirement.description,
      remediation: requirement.remediation,
      capabilityId: requirement.id,
      capabilityVersion: requirement.version,
    })),
    ...(manifest.requires?.resources ?? [])
      .filter((requirement) => requirement.required !== false)
      .map((requirement) => ({
        componentId,
        kind: "resource" as const,
        id: requirement.binding,
        title: requirement.title ?? requirement.type,
        description: requirement.description,
        remediation: requirement.remediation,
        resourceType: requirement.type,
      })),
  ];

  private toView = (
    requirements: DependencyRequirement[],
    bindings: AppPackageDependencyBinding[],
    providers: CapabilityProviderView[],
  ): AppPackageDependencyView => {
    const candidates = requirements.map((requirement): AppPackageDependencyCandidate => ({
      requirement: this.toReadinessRequirement(requirement),
      providers: this.findCandidates(requirement, providers),
    }));
    const requirementsWithState = candidates
      .filter(({ requirement, providers: candidatesForRequirement }) => {
        const source = this.toRequirement(requirement);
        const binding = this.findBinding(bindings, source);
        return !binding || !candidatesForRequirement.some((provider) => provider.providerId === binding.providerId);
      });
    const readinessRequirements = requirementsWithState.map(({ requirement }) => requirement);
    const readiness = this.toReadiness(readinessRequirements);
    return {
      readiness,
      bindings,
      candidates,
      resolvedProviderIds: this.toResolvedProviderIds(requirements, bindings, providers),
    };
  };

  private toReadiness = (requirements: AppPackageReadinessRequirement[]): AppPackageReadiness => ({
    status: requirements.some((requirement) => requirement.kind === "capability")
      ? "needs-capability"
      : requirements.some((requirement) => requirement.kind === "configuration")
        ? "needs-configuration"
        : "ready",
    requirements,
  });

  private toResolvedProviderIds = (
    requirements: DependencyRequirement[],
    bindings: AppPackageDependencyBinding[],
    providers: CapabilityProviderView[],
  ): Record<string, string[]> => {
    const availableProviderIds = new Set(providers.map((provider) => provider.providerId));
    const result: Record<string, string[]> = {};
    for (const requirement of requirements) {
      const binding = this.findBinding(bindings, requirement);
      if (!binding || !availableProviderIds.has(binding.providerId)) continue;
      const providerIds = result[requirement.componentId] ?? [];
      if (!providerIds.includes(binding.providerId)) providerIds.push(binding.providerId);
      result[requirement.componentId] = providerIds;
    }
    return result;
  };

  private findCandidates = (
    requirement: DependencyRequirement,
    providers: CapabilityProviderView[],
  ): CapabilityProviderView[] => providers.filter((provider) => this.providerMatches(requirement, provider));

  private providerMatches = (
    requirement: DependencyRequirement,
    provider: CapabilityProviderView,
  ): boolean => provider.capabilities.some((capability) => {
    if (requirement.kind === "capability") {
      return capability.id === requirement.capabilityId &&
        (!requirement.capabilityVersion || capability.version === requirement.capabilityVersion);
    }
    return capability.resourceTypes?.includes(requirement.resourceType as string) ?? false;
  });

  private requireRequirement = (
    requirements: DependencyRequirement[],
    input: Pick<AppPackageDependencyBindingInput, "componentId" | "requirementKind" | "requirementId">,
  ): DependencyRequirement => {
    const requirement = requirements.find((entry) =>
      entry.componentId === input.componentId && entry.kind === input.requirementKind && entry.id === input.requirementId);
    if (!requirement) {
      throw new AppPackageError(
        "APP_PACKAGE_NOT_FOUND",
        `Dependency ${input.componentId}/${input.requirementKind}/${input.requirementId} was not declared by this App.`,
      );
    }
    return requirement;
  };

  private toBinding = (
    requirement: DependencyRequirement,
    providerId: string,
  ): AppPackageDependencyBinding => ({
    componentId: requirement.componentId,
    requirementKind: requirement.kind,
    requirementId: requirement.id,
    providerId,
  });

  private findBinding = (
    bindings: AppPackageDependencyBinding[],
    requirement: DependencyRequirement,
  ): AppPackageDependencyBinding | undefined => bindings.find((entry) =>
    this.isBindingForRequirement(entry, requirement));

  private isBindingForRequirement = (
    binding: AppPackageDependencyBinding,
    requirement: DependencyRequirement,
  ): boolean => binding.componentId === requirement.componentId &&
    binding.requirementKind === requirement.kind && binding.requirementId === requirement.id;

  private requirementKey = (requirement: DependencyRequirement): string =>
    `${requirement.componentId}/${requirement.kind}/${requirement.id}`;

  private toRequirement = (
    requirement: AppPackageReadinessRequirement,
  ): DependencyRequirement => ({
    componentId: requirement.componentId,
    kind: requirement.kind === "capability" ? "capability" : "resource",
    id: requirement.id,
    title: requirement.title,
    description: requirement.description,
    remediation: requirement.remediation,
  });

  private toReadinessRequirement = (
    requirement: DependencyRequirement,
  ): AppPackageReadinessRequirement => ({
    componentId: requirement.componentId,
    kind: requirement.kind === "capability" ? "capability" : "configuration",
    id: requirement.id,
    title: requirement.title,
    description: requirement.description,
    remediation: requirement.remediation,
  });

  private readBindings = async (
    storage: AppStorageContext,
  ): Promise<AppPackageDependencyBinding[]> => {
    try {
      const parsed = JSON.parse(await readFile(this.storePath(storage), "utf8")) as unknown;
      if (!this.isStore(parsed)) {
        throw new Error("schema");
      }
      return this.normalizeBindings(parsed.bindings);
    } catch (error) {
      if (this.isMissingFileError(error)) return [];
      throw new AppPackageError(
        "APP_PACKAGE_OPERATION_FAILED",
        `App dependency bindings are invalid: ${error instanceof Error ? error.message : String(error)}.`,
      );
    }
  };

  private writeBindings = async (
    storage: AppStorageContext,
    bindings: AppPackageDependencyBinding[],
  ): Promise<void> => {
    await mkdir(storage.configDirectory, { recursive: true, mode: 0o700 });
    const filePath = this.storePath(storage);
    const stagedPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    const content = `${JSON.stringify({ schemaVersion: 1, bindings } satisfies DependencyStore, null, 2)}\n`;
    await writeFile(stagedPath, content, { encoding: "utf8", mode: 0o600 });
    await rename(stagedPath, filePath);
    await chmod(filePath, 0o600);
  };

  private normalizeBindings = (
    bindings: AppPackageDependencyBinding[],
  ): AppPackageDependencyBinding[] => {
    const unique = new Map<string, AppPackageDependencyBinding>();
    for (const binding of bindings) {
      if (!this.isBinding(binding)) throw new Error("invalid binding");
      unique.set(
        `${binding.componentId}/${binding.requirementKind}/${binding.requirementId}`,
        binding,
      );
    }
    return Array.from(unique.values()).sort((left, right) =>
      this.bindingKey(left).localeCompare(this.bindingKey(right)));
  };

  private bindingKey = (binding: AppPackageDependencyBinding): string =>
    `${binding.componentId}/${binding.requirementKind}/${binding.requirementId}`;

  private isStore = (value: unknown): value is DependencyStore => Boolean(value) &&
    typeof value === "object" &&
    (value as { schemaVersion?: unknown }).schemaVersion === 1 &&
    Array.isArray((value as { bindings?: unknown }).bindings);

  private isBinding = (value: unknown): value is AppPackageDependencyBinding => Boolean(value) &&
    typeof value === "object" &&
    IDENTIFIER_PATTERN.test((value as { componentId?: unknown }).componentId as string) &&
    (((value as { requirementKind?: unknown }).requirementKind === "capability") ||
      ((value as { requirementKind?: unknown }).requirementKind === "resource")) &&
    typeof (value as { requirementId?: unknown }).requirementId === "string" &&
    (value as { requirementId: string }).requirementId.length > 0 &&
    IDENTIFIER_PATTERN.test((value as { providerId?: unknown }).providerId as string);

  private storePath = (storage: AppStorageContext): string =>
    path.join(storage.configDirectory, STORE_FILE_NAME);

  private lockPath = (storage: AppStorageContext): string =>
    path.join(storage.configDirectory, LOCK_FILE_NAME);

  private isMissingFileError = (error: unknown): boolean => typeof error === "object" &&
    error !== null && (error as { code?: unknown }).code === "ENOENT";
}
