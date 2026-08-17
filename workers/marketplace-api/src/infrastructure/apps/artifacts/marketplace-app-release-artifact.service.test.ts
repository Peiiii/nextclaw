import { describe, expect, it, vi } from "vitest";
import { MarketplaceAppReleaseArtifactService } from "./marketplace-app-release-artifact.service";

describe("MarketplaceAppReleaseArtifactService", () => {
  it("validates every target and checks version immutability before writing R2", async () => {
    const putBundle = vi.fn();
    const validate = vi.fn().mockResolvedValue(undefined);
    const service = new MarketplaceAppReleaseArtifactService(
      { decodeBase64: () => new Uint8Array([1, 2, 3]) } as never,
      { validate } as never,
      { putBundle } as never,
    );
    const input = {
      appId: "alice.native-todo",
      version: "1.0.0",
      artifacts: [
        {
          target: { kind: "native" as const, os: "darwin" as const, arch: "arm64" as const },
          bundleBase64: "YXBw",
          bundleSha256: "a".repeat(64),
          sizeBytes: 3,
        },
        {
          target: {
            kind: "native" as const,
            os: "linux" as const,
            arch: "x64" as const,
            abi: "gnu" as const,
          },
          bundleBase64: "YXBw",
          bundleSha256: "b".repeat(64),
          sizeBytes: 3,
        },
      ],
    };

    await expect(service.prepare(input as never, () => {
      throw new Error("immutable version");
    })).rejects.toThrow("immutable version");

    expect(validate).toHaveBeenCalledTimes(2);
    expect(putBundle).not.toHaveBeenCalled();
  });
});
