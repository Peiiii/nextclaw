import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { AppArtifactValidationService } from "./app-artifact-validation.service.js";
import { AppPlatformTargetService } from "./app-platform-target.service.js";
import type {
  AppArtifactTarget,
  AppComponentManifest,
} from "#app-runtime/types/app-manifest.types.js";

export type AppPreparedPublishArtifact = {
  target: AppArtifactTarget;
  targetKey: string;
  bundlePath: string;
  bytes: Buffer;
  sha256: string;
  sizeBytes: number;
  filePaths: string[];
};

export class AppPublishArtifactService {
  constructor(
    private readonly artifactValidationService = new AppArtifactValidationService(),
    private readonly platformTargetService = new AppPlatformTargetService(),
  ) {}

  collect = async (params: {
    manifest: AppComponentManifest;
    artifactsDirectory: string;
  }): Promise<AppPreparedPublishArtifact[]> => {
    const distribution = this.platformTargetService.resolveDistribution(
      params.manifest.distribution,
    );
    if (distribution.mode !== "targeted") {
      throw new Error("只有 targeted App 才能使用 --artifacts 发布平台产物。");
    }
    const artifactsDirectory = path.resolve(params.artifactsDirectory);
    const entries = (await readdir(artifactsDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".napp"))
      .sort((left, right) => left.name.localeCompare(right.name));
    if (entries.length === 0) {
      throw new Error(`artifacts 目录中没有 .napp 文件：${artifactsDirectory}`);
    }

    const artifacts = await Promise.all(entries.map(async (entry) => {
      const targetKey = entry.name.slice(0, -".napp".length);
      const target = this.platformTargetService.parseTargetKey(targetKey);
      if (target.kind !== "native") {
        throw new Error("targeted App 的 artifacts 不能包含 universal.napp。");
      }
      const bundlePath = path.join(artifactsDirectory, entry.name);
      const bytes = Buffer.from(await readFile(bundlePath));
      const validation = await this.artifactValidationService.validate({
        bytes,
        expected: {
          appId: params.manifest.id,
          name: params.manifest.name,
          version: params.manifest.version,
          distributionMode: "bundle",
          manifest: params.manifest,
          target,
        },
      });
      return {
        target,
        targetKey,
        bundlePath,
        bytes,
        sha256: validation.artifactSha256,
        sizeBytes: bytes.byteLength,
        filePaths: Object.keys(validation.archive).sort((left, right) =>
          left.localeCompare(right),
        ),
      };
    }));

    this.platformTargetService.assertExactTargetSet({
      declared: distribution.targets,
      actual: artifacts.map((artifact) => artifact.target),
      actualLabel: "上传 artifacts",
    });
    return artifacts;
  };
}
