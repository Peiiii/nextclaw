import { DomainValidationError } from "@/domain/errors";
import { AppArtifactValidationService } from "@nextclaw/app-runtime";
import type {
  MarketplaceAppArtifactInput,
  MarketplaceAppPublishInput,
} from "./app-marketplace.types";

export class MarketplaceAppArtifactValidationService {
  constructor(
    private readonly artifactValidator = new AppArtifactValidationService(),
  ) {}

  validate = async (
    bundleBytes: Uint8Array,
    input: MarketplaceAppPublishInput,
    submittedArtifact?: MarketplaceAppArtifactInput,
  ): Promise<void> => {
    try {
      const artifact = await this.artifactValidator.validate({
        bytes: bundleBytes,
        expected: {
          appId: input.appId,
          name: input.name,
          version: input.version,
          distributionMode: input.distributionMode,
          manifest: input.manifest,
          target: submittedArtifact?.target,
        },
      });
      const expectedSha256 = submittedArtifact?.bundleSha256 ??
        ("bundleSha256" in input ? input.bundleSha256 : undefined);
      if (!expectedSha256) {
        throw new DomainValidationError("artifact sha256 is missing");
      }
      if (submittedArtifact && bundleBytes.byteLength !== submittedArtifact.sizeBytes) {
        throw new DomainValidationError(
          `artifact size mismatch: expected ${submittedArtifact.sizeBytes}, actual ${bundleBytes.byteLength}`,
        );
      }
      if (artifact.artifactSha256 !== expectedSha256) {
        throw new DomainValidationError(
          `bundleSha256 mismatch: expected ${expectedSha256}, actual ${artifact.artifactSha256}`,
        );
      }
    } catch (error) {
      if (error instanceof DomainValidationError) {
        throw error;
      }
      throw new DomainValidationError(
        `invalid app bundle: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
}
