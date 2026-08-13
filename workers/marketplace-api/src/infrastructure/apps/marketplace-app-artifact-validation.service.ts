import { DomainValidationError } from "@/domain/errors";
import { AppArtifactValidationService } from "@nextclaw/app-runtime/artifact-validation";
import type { MarketplaceAppPublishInput } from "./app-marketplace.types";

export class MarketplaceAppArtifactValidationService {
  constructor(
    private readonly artifactValidator = new AppArtifactValidationService(),
  ) {}

  validate = async (
    bundleBytes: Uint8Array,
    input: MarketplaceAppPublishInput,
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
        },
      });
      if (artifact.artifactSha256 !== input.bundleSha256) {
        throw new DomainValidationError(
          `bundleSha256 mismatch: expected ${input.bundleSha256}, actual ${artifact.artifactSha256}`,
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
