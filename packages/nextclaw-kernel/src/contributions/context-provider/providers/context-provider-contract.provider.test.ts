import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { NcpTool } from "@nextclaw/ncp";
import {
  CHAT_INLINE_TOKENS_METADATA_KEY,
  CHAT_WORKSPACE_FILE_TOKEN_KIND,
  EventBus,
} from "@nextclaw/shared";
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

function createRequest(
  workspace: string,
  metadata?: Record<string, unknown>,
): AgentRunRequest {
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
    metadata: metadata ?? {},
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
    const hostWorkspace = createWorkspace();
    const projectRoot = createWorkspace();
    const projectSkillDir = join(projectRoot, ".agents", "skills", "project-review");
    writeFileSync(join(hostWorkspace, "AGENTS.md"), "NextClaw workspace rules.\n");
    writeFileSync(join(projectRoot, "AGENTS.md"), "Project rules.\n");
    writeFileSync(join(projectRoot, "reference.ts"), "export const referenced = true;\n");
    mkdirSync(join(hostWorkspace, "skills", "demo-skill"), { recursive: true });
    writeFileSync(
      join(hostWorkspace, "skills", "demo-skill", "SKILL.md"),
      [
        "---",
        "name: demo-skill",
        "description: Demo skill for routing tests",
        "---",
        "",
        "Use the demo skill instructions.",
      ].join("\n"),
    );
    mkdirSync(projectSkillDir, { recursive: true });
    writeFileSync(
      join(projectSkillDir, "SKILL.md"),
      [
        "---",
        "name: project-review",
        "description: Project review instructions",
        "---",
        "",
        "Review this project.",
      ].join("\n"),
    );
    const contextProviderManager = new ContextProviderManager();
    const contribution = new ContextProviderContribution({
      contextProviderManager,
      configManager: { loadConfig: () => createConfig(hostWorkspace) },
      agents: {
        resolveAgentProfileForRun: () => ({
          builtIn: true,
          contextTokens: 200000,
          default: true,
          displayName: "Main",
          id: "main",
          model: "openai/gpt-5",
          reservedContextTokens: 0,
          workspace: hostWorkspace,
        }),
      },
      sessionManager: {
        getAgentRunSession: async () => ({
          sessionId: "session-1",
          agentId: "main",
          metadata: {
            project_root: projectRoot,
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
      createRequest(projectRoot, {
        requested_skill_refs: [`project:${projectSkillDir}`],
        [CHAT_INLINE_TOKENS_METADATA_KEY]: [
          {
            kind: CHAT_WORKSPACE_FILE_TOKEN_KIND,
            key: "reference.ts",
            label: "reference.ts",
            rawText: "@file:reference.ts",
          },
        ],
      }),
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
      "## Explicit Workspace References",
      "export const referenced = true;",
      "# Agent Bootstrap Context",
      "Agent bootstrap files loaded:",
      "## AGENTS.md\n\nProject rules.",
      "# NextClaw Workspace Bootstrap Context",
      "## AGENTS.md\n\nNextClaw workspace rules.",
      "## Skill Sources",
      `${join(projectRoot, ".agents", "skills")}/<skill-name>/SKILL.md`,
      '<skill_group scope="project" source="project">',
      '<skill_group scope="workspace" source="workspace">',
      "# Active Skills",
      `<ref>project:${projectSkillDir}</ref>`,
      "<name>demo-skill</name>",
      "<name>visualize-output</name>",
      "## Session Orchestration",
      "## Tool Use Enforcement",
      "## OpenAI/Codex Execution Discipline",
      "## Current Session",
      "## Agent Output & Reply Formatting Contract",
      "Content after the last tool call remains directly visible",
      "fenced `mermaid` block",
      "MUST read the built-in `visualize-output` SKILL.md",
      "infer the appropriate medium without requiring the user to name it",
      "before any visualization tool call",
      "follow its data-fidelity rules",
      "State only facts and mathematical relationships directly supported by the user's input",
      "calculate every derived number with a tool",
      "stop at what the data shows rather than why it happened or what to do",
      "`nextclaw-inline` `file` target",
      "never represent generated local HTML as a URL",
      "duplicate the visual with a second table/list",
      "your FIRST tool call MUST be `read_file`",
      "regardless of whether the user explicitly said inline",
      "must contain only the fenced `nextclaw-inline` declaration",
      "the declaration's closing fence must be the final content",
      "Persistent visualization assets:",
      ["assets", "visualizations", "session-1"].join(sep),
      "emit its absolute `file` payload path",
      "Inline display:",
      "display-only",
    ]) {
      expect(context).toContain(expected);
    }
    const activeSkillsContext = context.slice(
      context.indexOf("# Active Skills"),
      context.indexOf("## Skills (mandatory)"),
    );
    expect(activeSkillsContext).toContain(`<ref>project:${projectSkillDir}</ref>`);
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
      "## Agent Output & Reply Formatting Contract",
    ]);

    contribution.dispose();
  });
});
