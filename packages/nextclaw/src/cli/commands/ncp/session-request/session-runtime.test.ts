import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, SessionManager } from "@nextclaw/core";
import { SessionCreationService } from "./session-creation.service.js";
import { SessionSpawnTool } from "./session-spawn.tool.js";

const tempDirs: string[] = [];

function createTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-session-runtime-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("session runtime mapping", () => {
  it("maps runtime onto session_type metadata and marks non-native runtimes as external", () => {
    const workspace = createTempWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "default-model"
        }
      }
    });
    const sessionManager = new SessionManager(workspace);
    const service = new SessionCreationService(sessionManager, () => config);

    const created = service.createSession({
      task: "Review deployment",
      sourceSessionMetadata: {},
      runtime: "codex"
    });

    expect(created.sessionType).toBe("codex");
    expect(created.runtimeFamily).toBe("external");
    expect(created.metadata.session_type).toBe("codex");
    expect(created.metadata.runtime).toBe("codex");

    const defaultSession = service.createSession({
      task: "Default path",
      sourceSessionMetadata: {}
    });

    expect(defaultSession.sessionType).toBe("native");
    expect(defaultSession.runtimeFamily).toBe("native");
    expect(defaultSession.metadata.session_type).toBe("native");
    expect(defaultSession.metadata.runtime).toBe("native");
  });

  it("forwards runtime through sessions_spawn", async () => {
    const createSession = vi.fn().mockReturnValue({
      sessionId: "session-1",
      agentId: "main",
      sessionType: "codex",
      runtimeFamily: "external",
      lifecycle: "persistent",
      title: "Review deployment",
      metadata: {
        session_type: "codex",
        runtime: "codex"
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const tool = new SessionSpawnTool({
      createSession
    } as unknown as SessionCreationService, {} as never);
    tool.setContext({
      sourceSessionId: "source-session",
      sourceSessionMetadata: {}
    });

    const result = await tool.execute({
      task: "Review deployment",
      runtime: "codex"
    });

    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      task: "Review deployment",
      runtime: "codex"
    }));
    expect(result).toMatchObject({
      kind: "nextclaw.session",
      sessionId: "session-1",
      sessionType: "codex"
    });
  });

  it("forwards runtime through child sessions_spawn requests", async () => {
    const spawnSessionAndRequest = vi.fn().mockResolvedValue({
      kind: "nextclaw.session_request",
      requestId: "request-1",
      sessionId: "child-session-1",
      targetKind: "child",
      isChildSession: true,
      lifecycle: "persistent",
      task: "Investigate logs",
      status: "running",
      notify: "final_reply"
    });
    const tool = new SessionSpawnTool(
      {} as never,
      {
        spawnSessionAndRequest
      } as never
    );
    tool.setContext({
      sourceSessionId: "source-session",
      sourceSessionMetadata: {},
      handoffDepth: 0
    });

    await tool.execute({
      scope: "child",
      task: "Investigate logs",
      runtime: "codex",
      request: {
        notify: "final_reply"
      }
    }, "tool-call-1");

    expect(spawnSessionAndRequest).toHaveBeenCalledWith(expect.objectContaining({
      task: "Investigate logs",
      runtime: "codex",
      parentSessionId: "source-session",
      notify: "final_reply"
    }));
  });
});
