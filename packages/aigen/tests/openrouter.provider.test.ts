import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenRouterProvider } from "../src/providers/openrouter.provider.js";

const originalFetch = globalThis.fetch;

describe("OpenRouterProvider", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("extracts generated image data URLs", async () => {
    const provider = new OpenRouterProvider();
    const dataUrl = `data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}`;

    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: "request-id",
          choices: [
            {
              message: {
                images: [
                  {
                    image_url: {
                      url: dataUrl
                    }
                  }
                ]
              }
            }
          ],
          usage: {
            prompt_tokens: 1
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;

    const result = await provider.generateImage(
      {
        providerLocalModel: "vendor/model-id",
        prompt: "hello",
        n: 1
      },
      {
        providerId: "openrouter",
        apiFormat: "openrouter",
        apiBase: "https://openrouter.ai/api/v1",
        apiKey: "test-key"
      },
    );

    expect(result.images).toHaveLength(1);
    expect(result.images[0]?.mimeType).toBe("image/png");
    expect(Buffer.from(result.images[0]?.bytes ?? []).toString()).toBe("png-bytes");
    expect(result.upstreamRequestId).toBe("request-id");
  });

  it("lists remote image models", async () => {
    const provider = new OpenRouterProvider();

    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: "vendor/model-id",
              name: "Model ID",
              architecture: {
                input_modalities: ["text"],
                output_modalities: ["image"]
              },
              pricing: {
                prompt: "0"
              }
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;

    const result = await provider.listRemoteModels(
      { kind: "image" },
      {
        providerId: "openrouter",
        apiFormat: "openrouter",
        apiBase: "https://openrouter.ai/api/v1",
        apiKey: "test-key"
      },
    );

    expect(result.models[0]).toMatchObject({
      providerLocalModel: "vendor/model-id",
      displayName: "Model ID",
      outputModalities: ["image"]
    });
  });
});
