import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpMessagePart,
} from "@nextclaw/ncp";
import {
  StdioRuntimeNcpAgentRuntime,
  type StdioRuntimeNcpAgentRuntimeConfig,
} from "@stdio-runtime-client/index.js";

const FIXTURE_PATH = join(
  import.meta.dirname,
  "..",
  "test-fixtures",
  "echo-agent.utils.mjs",
);
const TEST_EXECUTION_CONTEXT = { cwd: dirname(FIXTURE_PATH) };

function createRuntime(
  config: Partial<StdioRuntimeNcpAgentRuntimeConfig> = {},
): StdioRuntimeNcpAgentRuntime {
  return new StdioRuntimeNcpAgentRuntime({
    wireDialect: "acp",
    processScope: "per-session",
    command: process.execPath,
    args: [FIXTURE_PATH],
    startupTimeoutMs: 10_000,
    probeTimeoutMs: 3_000,
    requestTimeoutMs: 30_000,
    ...config,
  });
}

async function runRuntime(
  runtime: StdioRuntimeNcpAgentRuntime,
  parts: NcpMessagePart[],
): Promise<NcpEndpointEvent[]> {
  const events: NcpEndpointEvent[] = [];
  for await (const event of runtime.run({
    sessionId: "session-stdio-input",
    messages: [
      {
        id: "user-input",
        sessionId: "session-stdio-input",
        role: "user",
        status: "final",
        timestamp: "2026-08-05T00:00:00.000Z",
        parts,
      },
    ],
    executionContext: TEST_EXECUTION_CONTEXT,
  })) {
    events.push(event);
  }
  return events;
}

describe("StdioRuntimeNcpAgentRuntime prompt input", () => {
  it("preserves asset-backed image attachments as ACP resource links", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "nextclaw-stdio-image-"));
    const imagePath = join(tempDir, "reference.png");
    await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const runtime = createRuntime({
      env: { NEXTCLAW_ECHO_PROMPT_INFO: "1" },
      resolveAssetContentPath: (assetUri) =>
        assetUri === "asset://test/reference" ? imagePath : null,
    });

    try {
      const events = await runRuntime(runtime, [
        {
          type: "file",
          name: "reference.png",
          mimeType: "image/png",
          assetUri: "asset://test/reference",
          sizeBytes: 4,
        },
        { type: "text", text: "inspect this image" },
      ]);
      const toolResultEvent = events.find(
        (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.MessageToolCallResult }> =>
          event.type === NcpEventType.MessageToolCallResult,
      );

      expect(toolResultEvent?.payload.content).toMatchObject({
        prompt: [
          {
            type: "resource_link",
            name: "reference.png",
            mimeType: "image/png",
            size: 4,
            uri: pathToFileURL(imagePath).href,
          },
          { type: "text", text: "inspect this image" },
        ],
      });
    } finally {
      await runtime.dispose();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("fails visibly when an asset attachment cannot be resolved", async () => {
    const runtime = createRuntime();
    let events: NcpEndpointEvent[] = [];
    try {
      events = await runRuntime(runtime, [
        {
          type: "file",
          name: "missing.png",
          mimeType: "image/png",
          assetUri: "asset://test/missing",
        },
      ]);
    } finally {
      await runtime.dispose();
    }

    expect(events.map((event) => event.type)).toEqual([
      NcpEventType.MessageAccepted,
      NcpEventType.RunStarted,
      NcpEventType.MessageFailed,
      NcpEventType.RunError,
    ]);
    const failedEvent = events.find(
      (event): event is Extract<NcpEndpointEvent, { type: NcpEventType.MessageFailed }> =>
        event.type === NcpEventType.MessageFailed,
    );
    expect(failedEvent?.payload.error.message).toContain(
      "cannot resolve attachment asset URI asset://test/missing",
    );
  });
});
