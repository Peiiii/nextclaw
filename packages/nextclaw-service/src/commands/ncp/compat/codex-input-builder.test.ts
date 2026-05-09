import { describe, expect, it } from "vitest";
import { buildCodexInputBuilder } from "../../../../../extensions/nextclaw-ncp-runtime-codex-sdk/src/index.js";

describe("codex input builder", () => {
  it("keeps plain text messages unchanged", async () => {
    const inputBuilder = buildCodexInputBuilder(
      {
        buildRuntimeUserPrompt: ({ userMessage }) => userMessage,
      },
      {
        workspace: "/tmp/workspace",
      },
    );

    const prompt = await inputBuilder({
      sessionId: "session-1",
      messages: [
        {
          id: "message-1",
          sessionId: "session-1",
          role: "user",
          status: "final",
          timestamp: "2026-04-09T00:00:00.000Z",
          parts: [{ type: "text", text: "Plan this rollout." }],
        },
      ],
    });

    expect(prompt).toBe("Plan this rollout.");
  });

  it("includes file parts as asset reference text for codex prompts", async () => {
    const inputBuilder = buildCodexInputBuilder(
      {
        buildRuntimeUserPrompt: ({ userMessage }) => userMessage,
      },
      {
        workspace: "/tmp/workspace",
      },
    );

    const prompt = await inputBuilder({
      sessionId: "session-1",
      messages: [
        {
          id: "message-2",
          sessionId: "session-1",
          role: "user",
          status: "final",
          timestamp: "2026-04-09T00:00:00.000Z",
          parts: [
            { type: "text", text: "Please inspect this screenshot." },
            {
              type: "file",
              name: "screen.png",
              mimeType: "image/png",
              assetUri: "asset://store/2026/04/09/asset_123",
              sizeBytes: 2048,
            },
          ],
        },
      ],
    });

    expect(prompt).toContain("Please inspect this screenshot.");
    expect(prompt).toContain("[Asset: screen.png]");
    expect(prompt).toContain("[MIME: image/png]");
    expect(prompt).toContain("[Asset URI: asset://store/2026/04/09/asset_123]");
    expect(prompt).toContain("[Instruction: This file is not embedded in the prompt.");
  });

  it("emits local_image inputs when an uploaded image has a resolved local path", async () => {
    const inputBuilder = buildCodexInputBuilder(
      {
        buildRuntimeUserPrompt: ({ userMessage }) => `Prompt:\n${userMessage}`,
      },
      {
        workspace: "/tmp/workspace",
        resolveAssetContentPath: (assetUri) =>
          assetUri === "asset://store/2026/04/09/asset_123" ? "/tmp/assets/screen.png" : null,
      },
    );

    const prompt = await inputBuilder({
      sessionId: "session-1",
      messages: [
        {
          id: "message-3",
          sessionId: "session-1",
          role: "user",
          status: "final",
          timestamp: "2026-04-09T00:00:00.000Z",
          parts: [
            { type: "text", text: "Please inspect this screenshot." },
            {
              type: "file",
              name: "screen.png",
              mimeType: "image/png",
              assetUri: "asset://store/2026/04/09/asset_123",
              sizeBytes: 2048,
            },
          ],
        },
      ],
    });

    expect(prompt).toEqual([
      {
        type: "text",
        text: expect.stringContaining("Prompt:\nPlease inspect this screenshot."),
      },
      {
        type: "local_image",
        path: "/tmp/assets/screen.png",
      },
    ]);
    const textPrompt = (prompt as Array<{ type: "text"; text: string }>)[0]?.text ?? "";
    expect(textPrompt).toContain("[Attached Image: screen.png]");
    expect(textPrompt).toContain("[Asset URI: asset://store/2026/04/09/asset_123]");
  });
});
