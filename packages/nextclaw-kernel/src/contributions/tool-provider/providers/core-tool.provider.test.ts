import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema } from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";

import type { ToolProviderRunContextService } from "@kernel/contributions/tool-provider/services/tool-provider-run-context.service.js";
import { CoreToolProvider } from "./core-tool.provider.js";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const PNG_BYTES = Buffer.from(PNG_BASE64, "base64");

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { force: true, recursive: true });
    }
  }
});

describe("CoreToolProvider", () => {
  it("provides view_image without a workspace read limit when restrictToWorkspace is false", async () => {
    const workspace = makeTempDir();
    const outsideImagePath = writePng(makeTempDir(), "outside.png");
    const provider = new CoreToolProvider(
      createRunContextService({ restrictToWorkspace: false, workspace }),
      () => undefined,
    );

    const viewImageTool = readExecutableTool(await provider.provide(createRequest()), "view_image");
    const result = await viewImageTool.execute({ path: outsideImagePath });

    expect(result).toEqual(expect.objectContaining({
      mimeType: "image/png",
      ok: true,
    }));
  });

  it("passes the workspace read limit to view_image when restrictToWorkspace is true", async () => {
    const workspace = makeTempDir();
    const outsideImagePath = writePng(makeTempDir(), "outside.png");
    const provider = new CoreToolProvider(
      createRunContextService({ restrictToWorkspace: true, workspace }),
      () => undefined,
    );

    const viewImageTool = readExecutableTool(await provider.provide(createRequest()), "view_image");

    await expect(viewImageTool.execute({ path: outsideImagePath })).rejects.toThrow(
      "Access denied: image path outside allowed directory.",
    );
  });
});

function createRunContextService(options: {
  restrictToWorkspace: boolean;
  workspace: string;
}): ToolProviderRunContextService {
  const config = ConfigSchema.parse({});
  return {
    resolve: async () => ({
      toolRunContext: {
        agentId: "default",
        channel: "ui",
        chatId: "chat-1",
        config,
        execTimeoutSeconds: 10,
        handoffDepth: 0,
        metadata: {},
        restrictToWorkspace: options.restrictToWorkspace,
        searchConfig: config.search,
        sessionId: "session-1",
        workspace: options.workspace,
      },
    }),
  } as ToolProviderRunContextService;
}

function createRequest() {
  return {
    message: {
      id: "message-1",
      parts: [],
      role: "user",
      sessionId: "session-1",
      status: "final",
      timestamp: "2026-07-05T00:00:00.000Z",
    },
  };
}

function readExecutableTool(
  tools: readonly NcpTool[],
  name: string,
): NcpTool & { execute: NonNullable<NcpTool["execute"]> } {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool?.execute) {
    throw new Error(`Expected executable tool "${name}" to be provided.`);
  }
  return tool as NcpTool & { execute: NonNullable<NcpTool["execute"]> };
}

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-core-tool-provider-"));
  tempDirs.push(dir);
  return dir;
}

function writePng(dir: string, name: string): string {
  const imagePath = join(dir, name);
  writeFileSync(imagePath, PNG_BYTES);
  return imagePath;
}
