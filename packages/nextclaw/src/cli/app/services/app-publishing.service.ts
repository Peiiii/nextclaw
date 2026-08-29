import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  AppBundleService,
  AppPlatformTargetService,
  AppPublishService,
  AppPublishValidationService,
} from "@nextclaw/app-runtime";
import type {
  NextClawAppPublishResult,
  NextClawAppPublishValidationResult,
} from "@nextclaw-cli/cli/app/types/app-publishing.types.js";

export class AppPublishingService {
  constructor(
    private readonly validationService: AppPublishValidationService = new AppPublishValidationService(),
    private readonly publishService: AppPublishService = new AppPublishService(),
    private readonly bundleService: AppBundleService = new AppBundleService(),
    private readonly platformTargetService: AppPlatformTargetService = new AppPlatformTargetService(),
  ) {}

  pack = async (params: {
    appDirectory: string;
    outputPath: string;
    target?: string;
  }) => {
    const { appDirectory, outputPath, target } = params;
    return this.bundleService.packAppDirectory({
      appDirectory,
      outputPath,
      mode: "bundle",
      target: target
        ? this.platformTargetService.parseTargetKey(target)
        : undefined,
    });
  };

  validate = async (params: {
    appDirectory: string;
    metadataPath?: string;
    artifactsDirectory?: string;
  }): Promise<NextClawAppPublishValidationResult> => {
    const result = await this.validationService.validate({
      appDirectory: params.appDirectory,
      metadataPath: params.metadataPath,
      artifactsDirectory: params.artifactsDirectory,
      mode: "bundle",
    });
    if (result.profile !== "components") {
      throw new Error(
        "nextclaw app publish 只支持由 Panel App 或 Service App 组成的 schema v2 Mini App。",
      );
    }
    if (result.distributionMode !== "bundle") {
      throw new Error("NextClaw Mini App 只支持 bundle 分发。");
    }
    return result as NextClawAppPublishValidationResult;
  };

  publish = async (params: {
    appDirectory: string;
    metadataPath?: string;
    artifactsDirectory?: string;
    allowWarnings?: boolean;
  }): Promise<NextClawAppPublishResult> => {
    const validation = await this.validate(params);
    if (validation.warnings.length > 0 && !params.allowWarnings) {
      const warningList = validation.warnings
        .map((warning) => `[${warning.code}] ${warning.message}`)
        .join("; ");
      throw new Error(
        `发布校验包含警告：${warningList}。确认后可使用 --allow-warnings 继续。`,
      );
    }
    const tempDirectory = await mkdtemp(
      path.join(tmpdir(), "nextclaw-app-publish-"),
    );
    try {
      const result = await this.publishService.publish({
        appDirectory: params.appDirectory,
        metadataPath: params.metadataPath,
        artifactsDirectory: params.artifactsDirectory,
        bundleOutputPath: path.join(tempDirectory, "artifact.napp"),
        mode: "bundle",
      });
      const { item } = result;
      return {
        validation,
        publish: {
          created: result.created,
          item: {
            slug: item.slug,
            appId: item.appId,
            ownerScope: item.ownerScope,
            appName: item.appName,
            publishStatus: item.publishStatus,
            name: item.name,
            latestVersion: item.latestVersion,
            webUrl:
              item.publishStatus === "published" ? item.webUrl : undefined,
          },
          fileCount: result.fileCount,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        message
          .replace(
            /缺少 marketplace publish token。请先登录 NextClaw，或传入 --token。?/g,
            "发布需要 NextClaw 平台登录态。请先运行 nextclaw login。",
          )
          .replace(/，或传入 --token。?/g, "。"),
      );
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  };
}
