import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { NcpTool } from "@nextclaw/ncp";
import {
  CHAT_INLINE_TOKENS_METADATA_KEY,
  CHAT_INLINE_TOKENS_SCHEMA_VERSION,
  CHAT_PROJECT_TOKEN_KIND,
  CHAT_WORKSPACE_EXCERPT_TOKEN_KIND,
  CHAT_WORKSPACE_FILE_TOKEN_KIND,
  EventBus,
} from "@nextclaw/shared";
import { ContextProviderContribution } from "@kernel/contributions/context-provider/index.js";
import {
  createCliQuickReferenceContextProvider,
  createMessagingContextProvider,
  createSelfUpdateContextProvider,
  createSilentRepliesContextProvider,
} from "@kernel/contributions/context-provider/providers/native-static-context.provider.js";
import { ContextProviderManager } from "@kernel/managers/context-provider.manager.js";
import { createShowContentTools } from "@kernel/tools/show-content.tools.js";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";

const tempWorkspaces: string[] = [];
const NATIVE_CONTEXT_SECTION_ORDER = [
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
  "## Skills",
  "# Skill Learning Loop",
  "## Session Orchestration",
  "## Tool Use Enforcement",
  "## Current Session",
  "## Agent Output & Reply Formatting Contract",
] as const;

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
        model: "minimax/MiniMax-M3",
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

function assertOrder(text: string, markers: readonly string[]): void {
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

describe("Messaging context delivery policy", () => {
  it("prefers the inbox for durable content without an external route", async () => {
    const workspace = createWorkspace();
    const [context] = await createMessagingContextProvider().provide(createRequest(workspace));

    expect(context).toContain("Durable reading material with no explicit external destination");
    expect(context).toContain("collected news, briefings, reports, recommendations, and articles");
    expect(context).toContain('Wording such as "send it to me" alone does not name a chat channel');
    expect(context).toContain("do not infer Weixin or another channel");
  });

  it("requires the silent marker without escaped or leading newlines", async () => {
    const workspace = createWorkspace();
    const [context] = await createSilentRepliesContextProvider().provide(createRequest(workspace));

    expect(context).toContain("respond with EXACTLY <noreply/>");
    expect(context).toContain('✅ Right: "<noreply/>"');
    expect(context).not.toContain("two blank lines");
    expect(context).not.toContain("\\n\\n<noreply/>");
  });
});

describe("NextClaw lifecycle command context", () => {
  it("uses top-level service commands and delegates restart to an external terminal", async () => {
    const workspace = createWorkspace();
    const [quickReference] = await createCliQuickReferenceContextProvider().provide(createRequest(workspace));
    const [selfUpdate] = await createSelfUpdateContextProvider().provide(createRequest(workspace));
    const context = `${quickReference}\n${selfUpdate}`;

    expect(context).toContain("nextclaw status");
    expect(context).toContain("nextclaw start");
    expect(context).toContain("nextclaw restart");
    expect(context).toContain("nextclaw stop");
    expect(context).toContain("run `nextclaw restart` in an external terminal");
    expect(context).not.toContain("nextclaw gateway restart");
  });
});

describe("ContextProviderContribution native prompt contract", () => {
  it("assembles the native context through kernel providers in the legacy prompt order", async () => {
    const hostWorkspace = createWorkspace();
    const projectRoot = createWorkspace();
    const referencedProjectRoot = realpathSync(createWorkspace());
    const projectSkillDir = join(projectRoot, ".agents", "skills", "project-review");
    writeFileSync(join(hostWorkspace, "AGENTS.md"), "NextClaw workspace rules.\n");
    writeFileSync(join(projectRoot, "AGENTS.md"), "Project rules.\n");
    writeFileSync(join(projectRoot, "reference.ts"), "export const referenced = true;\n");
    writeFileSync(join(referencedProjectRoot, "PROJECT.md"), "# Referenced project\n");
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
          model: "minimax/MiniMax-M3",
          reservedContextTokens: 0,
          workspace: hostWorkspace,
        }),
      },
      sessionManager: {
        getSessionRecord: async () => null,
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
      projectManager: {
        listProjects: async () => [{
          name: "Referenced",
          rootPath: referencedProjectRoot,
          createdAt: "2026-07-28T00:00:00.000Z",
          updatedAt: "2026-07-28T00:00:00.000Z",
        }],
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
    await contribution.start();

    const blocks = await contextProviderManager.buildContext(
      createRequest(projectRoot, {
        requested_skill_refs: [`project:${projectSkillDir}`],
        [CHAT_INLINE_TOKENS_METADATA_KEY]: {
          schemaVersion: CHAT_INLINE_TOKENS_SCHEMA_VERSION,
          items: [
            {
              kind: CHAT_WORKSPACE_FILE_TOKEN_KIND,
              key: "reference.ts",
              label: "reference.ts",
              rawText: "@file:reference.ts",
            },
            {
              kind: CHAT_WORKSPACE_EXCERPT_TOKEN_KIND,
              key: "reference.ts#excerpt-contract",
              path: "reference.ts",
              label: "reference.ts",
              excerpt: "selected contract snapshot",
              startLine: 3,
              endLine: 4,
              rawText: "@excerpt:reference.ts%23excerpt-contract",
            },
            {
              kind: CHAT_PROJECT_TOKEN_KIND,
              key: referencedProjectRoot,
              label: "Referenced",
              rawText: `@project:${encodeURIComponent(referencedProjectRoot)}`,
            },
          ],
        },
      }),
    );
    const context = blocks
      .map((block) => block.trim())
      .filter(Boolean)
      .join("\n\n");

    for (const expected of [
      "You are a personal assistant running inside nextclaw.",
      "provider tool schemas are the complete policy-filtered tool catalog",
      "# Project Context",
      "## Explicit Workspace References",
      "export const referenced = true;",
      '<workspace_excerpt path="reference.ts" start_line="3" end_line="4">',
      "selected contract snapshot",
      `<project_reference name="Referenced" root_path="${referencedProjectRoot}">`,
      "PROJECT.md",
      "# Agent Bootstrap Context",
      "Agent bootstrap files loaded:",
      "## AGENTS.md\n\nProject rules.",
      "# NextClaw Workspace Bootstrap Context",
      "## AGENTS.md\n\nNextClaw workspace rules.",
      "## Skill Sources",
      `${join(projectRoot, ".agents", "skills")}/<skill-name>/SKILL.md`,
      "# Active Skills",
      "### project skills",
      `Root: \`${join(projectRoot, ".agents", "skills")}\``,
      "- project-review — Project review instructions",
      "### workspace skills",
      "- demo-skill — Demo skill for routing tests",
      "### builtin skills",
      "- visualize-output —",
      "## Session Orchestration",
      "## Tool Use Enforcement",
      "## OpenAI/Codex Execution Discipline",
      "## Current Session\nChannel: ui\nChat ID: web-ui\nSession: session-1\nModel: openai/gpt-5",
      "## Agent Output & Reply Formatting Contract",
      "After that call, always write a concise, self-contained final response",
      "fenced `mermaid` block",
      "FIRST tool call MUST be `read_file`",
      "built-in `visualize-output` SKILL.md",
      "use only supported facts and mathematics",
      "calculate derived values with a tool",
      "For summary-only requests, stop at what the data shows",
      "use a `nextclaw-inline` `file` target",
      "must contain only the fenced `nextclaw-inline` declaration",
      "Visualization assets:",
      ["assets", "visualizations", "session-1"].join(sep),
      "Inline display:",
      "display-only",
    ]) {
      expect(context).toContain(expected);
    }
    expect(context).not.toContain("- read_file: Read file contents");
    expect(context).not.toContain("<skill_group");
    expect(context).not.toContain("<location>");
    const activeSkillsContext = context.slice(
      context.indexOf("# Active Skills"),
      context.indexOf("## Skills"),
    );
    expect(activeSkillsContext).toContain("- project-review — Project review instructions");
    for (const forbidden of [
      'placement="inline"',
      'placement="side_panel"',
      "Optional display placement",
      '"inline" embeds a compact card',
    ]) {
      expect(context).not.toContain(forbidden);
    }
    assertOrder(context, NATIVE_CONTEXT_SECTION_ORDER);

    await contribution.dispose();
  });
});
