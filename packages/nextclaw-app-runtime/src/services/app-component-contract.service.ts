import { readFile } from "node:fs/promises";
import path from "node:path";
import { strFromU8 } from "fflate";
import { AppPlatformTargetService } from "#app-runtime/services/app-platform-target.service.js";
import type {
  AppComponentManifest,
  AppComponentReference,
  AppDistributionDeclaration,
  AppRuntimeProfile,
} from "#app-runtime/types/app-manifest.types.js";
import {
  assertWasmComponentBinary,
  parseAppServiceComponentContract,
} from "#app-runtime/utils/app-service-component-contract.utils.js";

const COMPONENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type AppArtifactComponentIdentity = {
  components?: unknown;
  runtime?: unknown;
  distribution?: unknown;
};

export class AppComponentContractService {
  constructor(
    private readonly platformTargetService = new AppPlatformTargetService(),
  ) {}

  loadDirectoryComponent = async (params: {
    component: AppComponentReference;
    componentDirectory: string;
    runtimeProfile: AppRuntimeProfile;
  }): Promise<{ id: string }> => {
    const { component, componentDirectory, runtimeProfile } = params;
    const manifestFile = component.kind === "panel" ? "panel-app.json" : "service-app.json";
    const label = `${component.path}/${manifestFile}`;
    const manifest = this.assertRecord(
      JSON.parse(await readFile(path.join(componentDirectory, manifestFile), "utf8")) as unknown,
      label,
    );
    if (component.kind === "service") {
      parseAppServiceComponentContract({ manifest, runtimeProfile, label });
    }
    return { id: this.readComponentId({ component, componentDirectory, manifest, label }) };
  };

  assertRuntimeDistribution = (
    runtime: AppComponentManifest["runtime"],
    distribution: AppDistributionDeclaration | undefined,
  ): void => {
    if (
      runtime?.profile === "wasi" &&
      this.platformTargetService.resolveDistribution(distribution).mode !== "universal"
    ) {
      throw new Error("runtime.profile=wasi 只支持 distribution.mode=universal。");
    }
  };

  assertArtifact = (params: {
    archive: Record<string, Uint8Array>;
    identity: AppArtifactComponentIdentity;
    manifest: Record<string, unknown>;
    distributionMode: string;
  }): void => {
    const { archive, identity, manifest, distributionMode } = params;
    if (distributionMode !== "bundle") {
      throw new Error("schema v2 组合包只支持 bundle 分发。");
    }
    if (!Array.isArray(identity.components) || identity.components.length === 0) {
      throw new Error("schema v2 manifest.components 必须是非空数组。");
    }
    const runtimeProfile = this.readArtifactRuntimeProfile(manifest);
    const distribution = this.platformTargetService.parseDistribution(identity.distribution);
    this.assertRuntimeDistribution({ profile: runtimeProfile }, distribution);
    for (const [index, rawComponent] of identity.components.entries()) {
      this.assertArtifactComponent({ archive, index, rawComponent, runtimeProfile });
    }
    if (!archive["marketplace.json"]) {
      throw new Error("schema v2 bundle 缺少 marketplace.json。");
    }
  };

  private assertArtifactComponent = (params: {
    archive: Record<string, Uint8Array>;
    index: number;
    rawComponent: unknown;
    runtimeProfile: AppRuntimeProfile;
  }): void => {
    const { archive, index, rawComponent, runtimeProfile } = params;
    if (!this.isRecord(rawComponent)) {
      throw new Error(`manifest.components[${index}] 必须是对象。`);
    }
    const { kind, path: componentPath } = rawComponent;
    if ((kind !== "panel" && kind !== "service") || typeof componentPath !== "string") {
      throw new Error(`manifest.components[${index}] 无效。`);
    }
    const normalizedPath = this.normalizeEntry(componentPath);
    const manifestPath = `${normalizedPath}/${kind === "panel" ? "panel-app.json" : "service-app.json"}`;
    const manifestBytes = archive[manifestPath];
    if (!manifestBytes) {
      throw new Error(`bundle 缺少组件 manifest：${manifestPath}`);
    }
    if (kind !== "service") return;
    const serviceManifest = this.readJsonEntry(manifestBytes, manifestPath);
    const contract = parseAppServiceComponentContract({
      manifest: serviceManifest,
      runtimeProfile,
      label: manifestPath,
    });
    if (!contract.componentEntry) return;
    const componentEntryPath = `${normalizedPath}/${contract.componentEntry}`;
    const componentBytes = archive[componentEntryPath];
    if (!componentBytes) {
      throw new Error(`bundle 缺少 Portable Component：${componentEntryPath}`);
    }
    assertWasmComponentBinary(componentBytes, componentEntryPath);
  };

  private readComponentId = (params: {
    component: AppComponentReference;
    componentDirectory: string;
    manifest: Record<string, unknown>;
    label: string;
  }): string => {
    const { component, componentDirectory, manifest, label } = params;
    const id = typeof manifest.id === "string" ? manifest.id.trim() : "";
    if (!id) throw new Error(`${label}.id 必须是非空字符串。`);
    if (!COMPONENT_ID_PATTERN.test(id)) {
      throw new Error(`组件 id 必须是 kebab-case：${id}`);
    }
    const directoryName = path.basename(componentDirectory);
    const expectedId = component.kind === "panel"
      ? directoryName.replace(/\.panel$/, "")
      : directoryName;
    if (component.kind === "panel" && !directoryName.endsWith(".panel")) {
      throw new Error(`Panel component 目录必须以 .panel 结尾：${component.path}`);
    }
    if (id !== expectedId) {
      throw new Error(`组件 id 必须与目录名一致：期望 ${expectedId}，实际 ${id}`);
    }
    return id;
  };

  private readArtifactRuntimeProfile = (
    manifest: Record<string, unknown>,
  ): AppRuntimeProfile => {
    const components = manifest.components;
    if (!Array.isArray(components)) {
      throw new Error("schema v2 manifest.components 必须是数组。");
    }
    const hasService = components.some((component) =>
      this.isRecord(component) && component.kind === "service"
    );
    const runtime = manifest.runtime;
    const explicitProfile = runtime === undefined
      ? undefined
      : this.isRecord(runtime) && typeof runtime.profile === "string"
        ? runtime.profile
        : null;
    if (
      explicitProfile !== undefined &&
      explicitProfile !== "panel-only" &&
      explicitProfile !== "wasi" &&
      explicitProfile !== "native-process"
    ) {
      throw new Error("manifest.runtime.profile 必须是 panel-only、wasi 或 native-process。");
    }
    const profile = explicitProfile ?? (hasService ? "native-process" : "panel-only");
    if (profile === "panel-only" && hasService) {
      throw new Error("runtime.profile=panel-only 不能包含 Service component。");
    }
    if (profile !== "panel-only" && !hasService) {
      throw new Error(`${profile} runtime 必须包含 Service component。`);
    }
    return profile;
  };

  private readJsonEntry = (bytes: Uint8Array, label: string): Record<string, unknown> => {
    try {
      return this.assertRecord(JSON.parse(strFromU8(bytes)) as unknown, label);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(`${label} 不是有效 JSON。`);
      throw error;
    }
  };

  private normalizeEntry = (rawName: string): string => {
    const normalized = rawName.replace(/\\/g, "/");
    const segments = normalized.split("/");
    if (
      !normalized || normalized.startsWith("/") || normalized.includes("\0") ||
      /^[A-Za-z]:/.test(normalized) ||
      segments.some((segment) => !segment || segment === "." || segment === "..")
    ) {
      throw new Error(`bundle 内包含非法路径：${rawName}`);
    }
    return segments.join("/");
  };

  private assertRecord = (value: unknown, label: string): Record<string, unknown> => {
    if (!this.isRecord(value)) throw new Error(`${label} 必须是对象。`);
    return value;
  };

  private isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
}
