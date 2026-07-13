import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { NcpTool } from "@nextclaw/ncp";
import { EventBus } from "@nextclaw/shared";
import { ContextProviderContribution } from "@kernel/contributions/context-provider/index.js";
import { ContextProviderManager } from "@kernel/managers/context-provider.manager.js";
import { createShowContentTools } from "@kernel/tools/show-content.tools.js";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";

const tempWorkspaces: string[] = [];

function createWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-context-provider-"));
  tempWorkspaces.push(workspace);
  return workspace;
}

function createConfig(workspace: string) {
  return {
    agents: {
      defaults: {
        workspace,
        model: "openai/gpt-5",
        engine: "native",
        engineConfig: {},
        thinkingDefault: "off",
        models: {},
        contextTokens: 200000,
        maxToolIterations: 1000,
      },
      context: {
        bootstrap: {
          files: [
            "AGENTS.md",
            "SOUL.md",
            "USER.md",
            "IDENTITY.md",
            "TOOLS.md",
            "BOOT.md",
            "BOOTSTRAP.md",
          ],
          minimalFiles: ["AGENTS.md", "SOUL.md", "TOOLS.md", "IDENTITY.md"],
          perFileChars: 4000,
          totalChars: 12000,
        },
        memory: {
          enabled: true,
          maxChars: 8000,
        },
      },
      list: [],
    },
    search: {},
    providers: {},
    tools: {
      restrictToWorkspace: false,
      exec: { timeout: 120 },
    },
  } as never;
}

function createRequest(workspace: string): AgentRunRequest {
  return {
    sessionId: "session-1",
    message: {
      id: "message-1",
      sessionId: "session-1",
      role: "user",
      status: "final",
      parts: [{ type: "text", text: "hello" }],
      timestamp: "2026-06-06T00:00:00.000Z",
    },
    projectRoot: workspace,
  };
}

function assertOrder(text: string, markers: string[]): void {
  let cursor = -1;
  for (const marker of markers) {
    const next = text.indexOf(marker);
    expect(next, marker).toBeGreaterThan(cursor);
    cursor = next;
  }
}

afterEach(() => {
  while (tempWorkspaces.length > 0) {
    rmSync(tempWorkspaces.pop()!, { recursive: true, force: true });
  }
});

describe("ContextProviderContribution native prompt contract", () => {
  it("assembles the native context through kernel providers in the legacy prompt order", async () => {
    const workspace = createWorkspace();
    writeFileSync(join(workspace, "AGENTS.md"), "Project rules.\n");
    mkdirSync(join(workspace, "skills", "demo-skill"), { recursive: true });
    writeFileSync(
      join(workspace, "skills", "demo-skill", "SKILL.md"),
      [
        "---",
        "name: demo-skill",
        "description: Demo skill for routing tests",
        "---",
        "",
        "Use the demo skill instructions.",
      ].join("\n"),
    );
    const contextProviderManager = new ContextProviderManager();
    const contribution = new ContextProviderContribution({
      contextProviderManager,
      configManager: { loadConfig: () => createConfig(workspace) },
      agents: {
        resolveAgentProfileForRun: () => ({
          builtIn: true,
          contextTokens: 200000,
          default: true,
          displayName: "Main",
          id: "main",
          model: "openai/gpt-5",
          reservedContextTokens: 0,
          workspace,
        }),
      },
      sessionManager: {
        getAgentRunSession: async () => ({
          sessionId: "session-1",
          agentId: "main",
          metadata: {
            project_root: workspace,
            last_channel: "ui",
            last_to: "web-ui",
          },
          model: "openai/gpt-5",
          thinkingEffort: null,
        }),
      },
      toolProviderManager: {
        buildTools: async (): Promise<NcpTool[]> => [
          {
            name: "read_file",
            description: "Read file contents",
            parameters: { type: "object", properties: {} },
          },
          ...createShowContentTools(new EventBus()),
        ],
      },
    } as never);
    contribution.start();

    const blocks = await contextProviderManager.buildContext(
      createRequest(workspace),
    );
    const context = blocks
      .map((block) => block.trim())
      .filter(Boolean)
      .join("\n\n");

    for (const expected of [
      "You are a personal assistant running inside nextclaw.",
      "- read_file: Read file contents",
      "- show_panel_app:",
      "side-panel only",
      "## Inline Interactive Surfaces",
      "weather card",
      "Do not make every UI an inline card",
      "card-first",
      "landscape composition",
      "wider than it is tall",
      "no reliance on document-level internal scrolling",
      "nextclawDisplayMode=card",
      "show_panel_app",
      "Markdown-only",
      "Supported targets are `panel_app`, `json`, `file`, and `url`",
      "non-clickable placeholders",
      "inert JSON snapshots",
      "Never call `show_panel_app` for inline display",
      "nextclaw-inline",
      "show_file",
      "`view_image` is only for giving the model visual input",
      'viewer="rendered"',
      'viewer="source"',
      "# Project Context",
      "# Agent Bootstrap Context",
      "Agent bootstrap files loaded:",
      "## AGENTS.md\n\nProject rules.",
      "<name>demo-skill</name>",
      "## Session Orchestration",
      "## Tool Use Enforcement",
      "## OpenAI/Codex Execution Discipline",
      "## Current Session",
      "## Reply Formatting",
      "Inline display:",
      "display-only",
    ]) {
      expect(context).toContain(expected);
    }
    for (const forbidden of [
      'placement="inline"',
      'placement="side_panel"',
      "Optional display placement",
      '"inline" embeds a compact card',
    ]) {
      expect(context).not.toContain(forbidden);
    }
    assertOrder(context, [
      "You are a personal assistant running inside nextclaw.",
      "## Tooling",
      "## Tool Call Style",
      "## Inline Interactive Surfaces",
      "## Chat Composer Tokens",
      "## Safety",
      "## nextclaw CLI Quick Reference",
      "## nextclaw Self-Update",
      "## Workspace",
      "## Reply Tags",
      "## Messaging",
      "## Memory Recall",
      "## Silent Replies",
      "## Runtime",
      "## nextclaw Self-Management Guide",
      "# Project Context",
      "# Agent Bootstrap Context",
      "## Skills (mandatory)",
      "# Skill Learning Loop",
      "## Session Orchestration",
      "## Tool Use Enforcement",
      "## Current Session",
      "## Reply Formatting",
    ]);

    contribution.dispose();
  });
});
