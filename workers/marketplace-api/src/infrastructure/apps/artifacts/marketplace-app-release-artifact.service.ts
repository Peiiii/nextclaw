import { AppPlatformTargetService } from "@nextclaw/app-runtime/platform-target";
import type {
  MarketplaceAppArtifactInput,
  MarketplaceAppPublishInput,
} from "../app-marketplace.types";
import type { MarketplaceAppArtifactValidationService } from "../marketplace-app-artifact-validation.service";
import type { MarketplaceAppFileStore } from "../marketplace-app-file.store";
import type { MarketplaceAppPayloadParser } from "../marketplace-app-payload.service";

export type MarketplacePreparedRelease = {
  releaseSha256: string;
  bundleStorageKey: string;
  artifacts: Array<{
    target: MarketplaceAppArtifactInput["target"];
    targetKey: string;
    sha256: string;
    sizeBytes: number;
    storageKey: string;
  }>;
};

export class MarketplaceAppReleaseArtifactService {
  private readonly platformTargetService = new AppPlatformTargetService({
    platform: "linux",
    arch: "x64",
    linuxAbi: "gnu",
  });

  constructor(
    private readonly payloadParser: MarketplaceAppPayloadParser,
    private readonly artifactValidator: MarketplaceAppArtifactValidationService,
    private readonly fileStore: MarketplaceAppFileStore,
  ) {}

  prepare = async (
    input: MarketplaceAppPublishInput,
    assertRelease: (releaseSha256: string) => void,
  ): Promise<MarketplacePreparedRelease> => this.isTargeted(input)
    ? this.prepareTargeted(input, assertRelease)
    : this.prepareUniversal(input, assertRelease);

  private prepareUniversal = async (
    input: Extract<MarketplaceAppPublishInput, { bundleBase64: string }>,
    assertRelease: (releaseSha256: string) => void,
  ): Promise<MarketplacePreparedRelease> => {
    const bytes = this.payloadParser.decodeBase64(input.bundleBase64, "bundleBase64");
    await this.artifactValidator.validate(bytes, input);
    assertRelease(input.bundleSha256);
    const stored = await this.fileStore.putBundle({
      appId: input.appId,
      version: input.version,
      bytes,
    });
    return {
      releaseSha256: input.bundleSha256,
      bundleStorageKey: stored.storageKey,
      artifacts: [],
    };
  };

  private prepareTargeted = async (
    input: Extract<MarketplaceAppPublishInput, { artifacts: unknown[] }>,
    assertRelease: (releaseSha256: string) => void,
  ): Promise<MarketplacePreparedRelease> => {
    const validated = await Promise.all(input.artifacts.map(async (submitted) => {
      const targetKey = this.platformTargetService.toTargetKey(submitted.target);
      const bytes = this.payloadParser.decodeBase64(
        submitted.bundleBase64,
        `artifacts.${targetKey}.bundleBase64`,
      );
      await this.artifactValidator.validate(bytes, input, submitted);
      return { bytes, submitted, targetKey };
    }));
    const releaseSha256 = await this.computeArtifactSetSha256(
      validated.map(({ submitted, targetKey }) => ({
        targetKey,
        sha256: submitted.bundleSha256,
        sizeBytes: submitted.sizeBytes,
      })),
    );
    assertRelease(releaseSha256);
    const artifacts = await Promise.all(validated.map(async ({ bytes, submitted, targetKey }) => {
      const stored = await this.fileStore.putBundle({
        appId: input.appId,
        version: input.version,
        targetKey,
        bytes,
      });
      return {
        target: submitted.target,
        targetKey,
        sha256: stored.sha256,
        sizeBytes: stored.sizeBytes,
        storageKey: stored.storageKey,
      };
    }));
    return {
      releaseSha256,
      bundleStorageKey: "",
      artifacts,
    };
  };

  private isTargeted = (
    input: MarketplaceAppPublishInput,
  ): input is Extract<MarketplaceAppPublishInput, { artifacts: unknown[] }> =>
    Array.isArray(input.artifacts);

  private computeArtifactSetSha256 = async (
    artifacts: Array<{ targetKey: string; sha256: string; sizeBytes: number }>,
  ): Promise<string> => {
    const canonical = [...artifacts]
      .sort((left, right) => left.targetKey.localeCompare(right.targetKey))
      .map((artifact) => `${artifact.targetKey}:${artifact.sha256}:${artifact.sizeBytes}`)
      .join("\n");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };
}
