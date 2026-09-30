import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CONTEXT_COMPACTION_METADATA_KEY } from "@nextclaw/core";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";
import type { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import { AgentBootstrapContextProvider } from "./agent-bootstrap-context.provider.js";
import { renderAgentBootstrapContext } from "@kernel/contributions/context-provider/utils/bootstrap-context.utils.js";

const tempWorkspaces: string[] = [];

function createWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-bootstrap-context-"));
  tempWorkspaces.push(workspace);
  return workspace;
}

function createRequest(workspace: string): AgentRunRequest {
  return {
    sessionId: "session-compacted",
    message: {
      id: "message-1",
      sessionId: "session-compacted",
      role: "user",
      status: "final",
      parts: [{ type: "text", text: "你好" }],
      timestamp: "2026-06-06T00:00:00.000Z",
    },
    projectRoot: workspace,
  };
}

function createCompactedCheckpoint() {
  return {
    version: 1,
    id: "ctx-1",
    status: "compressed",
    summary: "# Compressed Working Context\n\nContinue 《天脊书》.",
    coveredMessageCount: 2,
    coveredSessionMessageCount: 2,
    originalEstimatedTokens: 20_000,
    projectedEstimatedTokens: 900,
    createdAt: "2026-06-06T00:00:01.000Z",
    updatedAt: "2026-06-06T00:00:02.000Z",
  };
}

function createContext(workspace: string): ContextProviderRunContextService {
  return {
    resolve: async () => ({
      contextConfig: {
        bootstrap: {
          files: ["AGENTS.md", "BOOT.md", "BOOTSTRAP.md", "IDENTITY.md", "USER.md"],
          minimalFiles: ["AGENTS.md"],
          perFileChars: 4000,
          totalChars: 12000,
        },
        memory: {
          enabled: false,
          maxChars: 0,
        },
      },
      projectContext: {
        effectiveWorkspace: workspace,
        hostWorkspace: workspace,
        projectBootstrapRoot: workspace,
      },
      runContext: {
        sessionKey: "session-compacted",
        sessionMetadata: {
          [CONTEXT_COMPACTION_METADATA_KEY]: createCompactedCheckpoint(),
        },
      },
      toolCatalog: [],
    }),
  } as unknown as ContextProviderRunContextService;
}

afterEach(() => {
  while (tempWorkspaces.length > 0) {
    rmSync(tempWorkspaces.pop()!, { recursive: true, force: true });
  }
});

describe("AgentBootstrapContextProvider", () => {
  it("batch I/O preserves file order and budgets, and does not fetch later batches", async () => {
    const names = ["AGENTS.md", "SOUL.md", "USER.md", "IDENTITY.md", "unneeded.md"];
    const values = new Map(names.map((name) => [name, `${name} content`.repeat(4)]));
    const input = { config: { files: names, minimalFiles: ["AGENTS.md"], perFileChars: 30, totalChars: 45 },
      agentRoot: "/workspace", workspaceRoot: "/workspace", compacted: false,
      readText: (_root: string, name: string) => values.get(name)! };
    const serial = await renderAgentBootstrapContext(input);
    const batches: string[][] = [];
    const batched = await renderAgentBootstrapContext({ ...input, readTexts: async (_root, files, maxChars) => {
      expect(maxChars).toBe(30);
      batches.push([...files]);
      return new Map(files.map((name) => [name, values.get(name)!]));
    } });
    expect(batched).toBe(serial);
    expect(batches).toEqual([names.slice(0, 4)]);
  });

  it("a missing requested batch result fails rather than silently losing context", async () => {
    await expect(renderAgentBootstrapContext({
      config: { files: ["AGENTS.md"], minimalFiles: [], perFileChars: 4000, totalChars: 12000 },
      agentRoot: "/workspace", workspaceRoot: "/workspace", compacted: false,
      readText: () => "rules", readTexts: async () => new Map(),
    })).rejects.toThrow("Context batch omitted requested file");
  });

  it("omits onboarding bootstrap files for compacted sessions", async () => {
    const workspace = createWorkspace();
    mkdirSync(workspace, { recursive: true });
    writeFileSync(join(workspace, "AGENTS.md"), "Durable project rules.");
    writeFileSync(join(workspace, "BOOT.md"), "Startup instructions.");
    writeFileSync(join(workspace, "BOOTSTRAP.md"), "Ask for assistant name before doing anything.");
    writeFileSync(join(workspace, "IDENTITY.md"), "Fill this in during your first conversation.");
    writeFileSync(join(workspace, "USER.md"), "Learn about the person you are helping.");

    const blocks = await new AgentBootstrapContextProvider(createContext(workspace), {
      readText: (root, name) => existsSync(join(root, name)) ? readFileSync(join(root, name), "utf-8") : "",
    })
      .provide(createRequest(workspace));
    const context = blocks.join("\n\n");

    expect(context).toContain("## AGENTS.md\n\nDurable project rules.");
    expect(context).not.toContain("BOOT.md");
    expect(context).not.toContain("BOOTSTRAP.md");
    expect(context).not.toContain("IDENTITY.md");
    expect(context).not.toContain("USER.md");
    expect(context).not.toContain("Startup instructions.");
    expect(context).not.toContain("Ask for assistant name before doing anything.");
  });
});
