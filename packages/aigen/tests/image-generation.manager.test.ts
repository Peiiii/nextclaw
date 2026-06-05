import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ImageGenerationManager } from "../src/managers/image-generation.manager.js";
import { OutputFileManager } from "../src/managers/output-file.manager.js";
import { ProviderRuntimeManager } from "../src/managers/provider-runtime.manager.js";
import { ConfigRepository } from "../src/repositories/config.repository.js";
import { SecretsRepository } from "../src/repositories/secrets.repository.js";
import type { AigenImageProvider } from "../src/types/provider.types.js";

class FakeImageProvider implements AigenImageProvider {
  readonly apiFormat = "fake";

  generateImage = async () => ({
    images: [
      {
        bytes: Uint8Array.from(Buffer.from("image-bytes")),
        mimeType: "image/png"
      }
    ],
    upstreamRequestId: "fake-request"
  });
}

describe("ImageGenerationManager", () => {
  let homeDir: string;
  let outputDir: string;

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), "aigen-test-home-"));
    outputDir = await mkdtemp(join(tmpdir(), "aigen-test-output-"));
  });

  afterEach(async () => {
    await rm(homeDir, { recursive: true, force: true });
    await rm(outputDir, { recursive: true, force: true });
  });

  it("resolves config, secret, provider runtime, and writes image files", async () => {
    const configRepository = new ConfigRepository(homeDir);
    const secretsRepository = new SecretsRepository(homeDir);
    const manager = new ImageGenerationManager(
      configRepository,
      secretsRepository,
      new ProviderRuntimeManager([new FakeImageProvider()]),
      new OutputFileManager(),
    );

    await configRepository.addProvider("fake-provider", {
      apiFormat: "fake",
      apiBase: "https://example.com",
      apiKeyRef: "provider:fake-provider",
      models: {}
    });
    await configRepository.addModel("fake-provider", "model-id", {
      kind: "image",
      capabilities: {
        generate: true,
        maxCount: 1
      }
    });
    await secretsRepository.setProviderApiKey("fake-provider", "test-key");

    const output = await manager.generate({
      model: "fake-provider/model-id",
      prompt: "hello",
      outputDir,
      outputName: "result"
    });

    expect(output.assets[0]?.filename).toBe("result.png");
    expect(output.metadata?.upstreamRequestId).toBe("fake-request");
  });
});
