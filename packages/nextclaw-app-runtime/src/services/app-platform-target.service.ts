import type {
  AppArtifactArchitecture,
  AppArtifactTarget,
  AppDistributionDeclaration,
  AppNativeArtifactTarget,
} from "#app-runtime/types/app-manifest.types.js";

type AppTargetArtifact = {
  target: AppArtifactTarget;
};

type AppTargetVersion<TArtifact extends AppTargetArtifact> = {
  version: string;
  artifacts: TArtifact[];
};

type AppPlatformTargetServiceOptions = {
  platform?: NodeJS.Platform;
  arch?: string;
  linuxAbi?: "gnu" | "musl";
};

export class AppPlatformTargetService {
  private readonly platform: NodeJS.Platform;
  private readonly arch: string;
  private readonly linuxAbi?: "gnu" | "musl";

  constructor(options: AppPlatformTargetServiceOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.arch = options.arch ?? process.arch;
    this.linuxAbi = options.linuxAbi;
  }

  resolveDistribution = (
    distribution: AppDistributionDeclaration | undefined,
  ): AppDistributionDeclaration => distribution ?? { mode: "universal" };

  parseDistribution = (rawDistribution: unknown): AppDistributionDeclaration | undefined => {
    if (rawDistribution === undefined) {
      return undefined;
    }
    const candidate = this.assertObject(rawDistribution, "distribution");
    if (candidate.mode === "universal") {
      if (candidate.targets !== undefined) {
        throw new Error("distribution.mode=universal 不能声明 targets。");
      }
      return { mode: "universal" };
    }
    if (candidate.mode !== "targeted") {
      throw new Error("distribution.mode 只支持 universal 或 targeted。");
    }
    if (!Array.isArray(candidate.targets) || candidate.targets.length === 0) {
      throw new Error("distribution.mode=targeted 必须声明至少一个 target。");
    }
    const targets = candidate.targets.map((target, index) =>
      this.parseNativeTarget(target, `distribution.targets[${index}]`));
    const targetKeys = targets.map(this.toTargetKey);
    const duplicate = targetKeys.find(
      (targetKey, index) => targetKeys.indexOf(targetKey) !== index,
    );
    if (duplicate) {
      throw new Error(`distribution.targets 包含重复 target：${duplicate}`);
    }
    return { mode: "targeted", targets };
  };

  parseArtifactTarget = (rawTarget: unknown, fieldName = "target"): AppArtifactTarget => {
    const candidate = this.assertObject(rawTarget, fieldName);
    if (candidate.kind === "universal") {
      return { kind: "universal" };
    }
    return this.parseNativeTarget(candidate, fieldName);
  };

  parseTargetKey = (targetKey: string): AppArtifactTarget => {
    const normalized = targetKey.trim();
    if (normalized === "universal") {
      return { kind: "universal" };
    }
    const [os, arch, abi, ...extra] = normalized.split("-");
    if (extra.length > 0 || !os || !arch) {
      throw new Error(`非法 App target key：${targetKey}`);
    }
    return this.parseNativeTarget(
      { kind: "native", os, arch, ...(abi ? { abi } : {}) },
      "target",
    );
  };

  toTargetKey = (target: AppArtifactTarget): string => {
    if (target.kind === "universal") {
      return "universal";
    }
    return [target.os, target.arch, "abi" in target ? target.abi : undefined]
      .filter(Boolean)
      .join("-");
  };

  readHostTarget = (): AppNativeArtifactTarget => {
    const arch = this.readArchitecture(this.arch, "host architecture");
    if (this.platform === "darwin") {
      return { kind: "native", os: "darwin", arch };
    }
    if (this.platform === "linux") {
      return {
        kind: "native",
        os: "linux",
        arch,
        abi: this.linuxAbi ?? this.detectLinuxAbi(),
      };
    }
    if (this.platform === "win32") {
      return { kind: "native", os: "win32", arch, abi: "msvc" };
    }
    throw new Error(`当前平台不支持原生 App artifact：${this.platform}-${this.arch}`);
  };

  selectArtifact = <TArtifact extends AppTargetArtifact>(
    artifacts: readonly TArtifact[],
    hostTarget: AppNativeArtifactTarget = this.readHostTarget(),
  ): TArtifact | undefined => {
    const universal = artifacts.find((artifact) => artifact.target.kind === "universal");
    if (universal) {
      return universal;
    }
    const hostTargetKey = this.toTargetKey(hostTarget);
    return artifacts.find(
      (artifact) => this.toTargetKey(artifact.target) === hostTargetKey,
    );
  };

  selectLatestCompatibleVersion = <TArtifact extends AppTargetArtifact>(
    versions: readonly AppTargetVersion<TArtifact>[],
    hostTarget: AppNativeArtifactTarget = this.readHostTarget(),
  ): AppTargetVersion<TArtifact> | undefined => versions
    .filter((version) => this.selectArtifact(version.artifacts, hostTarget))
    .sort((left, right) => this.compareVersions(right.version, left.version))[0];

  assertExactTargetSet = (params: {
    declared: readonly AppArtifactTarget[];
    actual: readonly AppArtifactTarget[];
    actualLabel?: string;
  }): void => {
    const declared = [...new Set(params.declared.map(this.toTargetKey))].sort();
    const actual = [...new Set(params.actual.map(this.toTargetKey))].sort();
    if (
      declared.length !== params.declared.length ||
      actual.length !== params.actual.length
    ) {
      throw new Error("App target 集合不能包含重复项。");
    }
    if (
      declared.length !== actual.length ||
      declared.some((targetKey, index) => targetKey !== actual[index])
    ) {
      throw new Error(
        `声明 targets 与${params.actualLabel ?? "实际 artifacts"} 不一致：声明 [${declared.join(", ")}], 实际 [${actual.join(", ")}].`,
      );
    }
  };

  private parseNativeTarget = (
    rawTarget: unknown,
    fieldName: string,
  ): AppNativeArtifactTarget => {
    const candidate = this.assertObject(rawTarget, fieldName);
    if (candidate.kind !== "native") {
      throw new Error(`${fieldName}.kind 必须是 native。`);
    }
    const arch = this.readArchitecture(candidate.arch, `${fieldName}.arch`);
    if (candidate.os === "darwin") {
      if (candidate.abi !== undefined) {
        throw new Error(`${fieldName} 的 darwin target 不能声明 abi。`);
      }
      return { kind: "native", os: "darwin", arch };
    }
    if (candidate.os === "linux") {
      if (candidate.abi !== "gnu" && candidate.abi !== "musl") {
        throw new Error(`${fieldName} 的 linux target 必须声明 gnu 或 musl abi。`);
      }
      return { kind: "native", os: "linux", arch, abi: candidate.abi };
    }
    if (candidate.os === "win32") {
      if (candidate.abi !== "msvc") {
        throw new Error(`${fieldName} 的 win32 target 必须声明 msvc abi。`);
      }
      return { kind: "native", os: "win32", arch, abi: "msvc" };
    }
    throw new Error(`${fieldName}.os 只支持 darwin、linux 或 win32。`);
  };

  private readArchitecture = (
    value: unknown,
    fieldName: string,
  ): AppArtifactArchitecture => {
    if (value !== "x64" && value !== "arm64") {
      throw new Error(`${fieldName} 只支持 x64 或 arm64。`);
    }
    return value;
  };

  private detectLinuxAbi = (): "gnu" | "musl" => {
    const report = process.report?.getReport() as {
      header?: { glibcVersionRuntime?: unknown };
    } | undefined;
    return typeof report?.header?.glibcVersionRuntime === "string" &&
      report.header.glibcVersionRuntime.trim()
      ? "gnu"
      : "musl";
  };

  compareVersions = (left: string, right: string): number => {
    const leftParts = this.parseVersion(left);
    const rightParts = this.parseVersion(right);
    if (leftParts && rightParts) {
      for (let index = 0; index < 3; index += 1) {
        const difference = (leftParts.numbers[index] ?? 0) -
          (rightParts.numbers[index] ?? 0);
        if (difference !== 0) {
          return difference;
        }
      }
      if (leftParts.prerelease === rightParts.prerelease) {
        return 0;
      }
      if (!leftParts.prerelease) {
        return 1;
      }
      if (!rightParts.prerelease) {
        return -1;
      }
      return leftParts.prerelease.localeCompare(rightParts.prerelease, undefined, {
        numeric: true,
      });
    }
    return left.localeCompare(right, undefined, { numeric: true });
  };

  private parseVersion = (
    version: string,
  ): { numbers: [number, number, number]; prerelease?: string } | undefined => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
      version,
    );
    if (!match) {
      return undefined;
    }
    return {
      numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
      prerelease: match[4],
    };
  };

  private assertObject = (
    value: unknown,
    fieldName: string,
  ): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${fieldName} 必须是对象。`);
    }
    return value as Record<string, unknown>;
  };
}
