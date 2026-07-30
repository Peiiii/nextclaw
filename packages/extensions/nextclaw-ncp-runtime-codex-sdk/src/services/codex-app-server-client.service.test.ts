import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

import { CodexAppServerClient } from "./codex-app-server-client.service.js";

function createAppServerProcess() {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  stdin.on("data", (chunk) => {
    const message = JSON.parse(chunk.toString()) as { id?: number; method: string };
    if (message.method === "initialize" && message.id !== undefined) {
      stdout.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
    }
  });
  return Object.assign(new EventEmitter(), {
    stdin,
    stdout,
    stderr: new PassThrough(),
    kill: vi.fn(),
  });
}

async function initializeClient(codexPathOverride?: string): Promise<CodexAppServerClient> {
  const client = new CodexAppServerClient({
    sessionId: "session-1",
    apiKey: "",
    codexPathOverride,
  });
  await client.initialize();
  return client;
}

describe("CodexAppServerClient executable resolution", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    spawnMock.mockImplementation(createAppServerProcess);
  });

  it("launches the Codex CLI entry declared by the SDK dependency", async () => {
    const client = await initializeClient();
    const [executablePath, args] = spawnMock.mock.calls[0] ?? [];
    const codexCliEntry = args?.[0] as string;

    expect(executablePath).toBe(process.execPath);
    expect(codexCliEntry).toMatch(/[\\/]@openai[\\/]codex[\\/]bin[\\/]codex\.js$/);
    expect(codexCliEntry).not.toContain(`${process.platform === "win32" ? "\\" : "/"}node_modules${process.platform === "win32" ? "\\" : "/"}.bin`);
    expect(existsSync(codexCliEntry)).toBe(true);
    expect(args?.slice(1)).toEqual(["app-server", "--stdio"]);
    client.dispose();
  });

  it("keeps an explicit Codex executable override as the only alternate path", async () => {
    const client = await initializeClient("/opt/codex");

    expect(spawnMock).toHaveBeenCalledWith(
      "/opt/codex",
      ["app-server", "--stdio"],
      expect.any(Object),
    );
    client.dispose();
  });
});
