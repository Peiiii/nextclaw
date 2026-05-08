import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { SessionManager } from "@nextclaw/core";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { NextclawAgentSessionStore } from "../nextclaw-agent-session-store.js";
import { SessionSearchFeatureService } from "./session-search-feature.service.js";

const tempDirs: string[] = [];
const activeFeatures: SessionSearchFeatureService[] = [];
const originalNextclawHome = process.env.NEXTCLAW_HOME;

function createTempWorkspace(): { workspace: string; home: string } {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-session-search-"));
  const home = join(workspace, "home");
  mkdirSync(home, { recursive: true });
  process.env.NEXTCLAW_HOME = home;
  tempDirs.push(workspace);
  return { workspace, home };
}

function createSessionRecord(params: {
  sessionId: string;
  label?: string;
  userText?: string;
  assistantText?: string;
}): AgentSessionRecord {
  const timestamp = new Date().toISOString();
  const messages = [];
  if (params.userText) {
    messages.push({
      id: `${params.sessionId}:user`,
      sessionId: params.sessionId,
      role: "user" as const,
      status: "final" as const,
      timestamp,
      parts: [{ type: "text" as const, text: params.userText }],
    });
  }
  if (params.assistantText) {
    messages.push({
      id: `${params.sessionId}:assistant`,
      sessionId: params.sessionId,
      role: "assistant" as const,
      status: "final" as const,
      timestamp,
      parts: [{ type: "text" as const, text: params.assistantText }],
    });
  }

  return {
    sessionId: params.sessionId,
    updatedAt: timestamp,
    messages,
    metadata: params.label ? { label: params.label } : {},
  };
}

afterEach(async () => {
  while (activeFeatures.length > 0) {
    const feature = activeFeatures.pop();
    if (feature) {
      await feature.dispose();
    }
  }
  if (originalNextclawHome) {
    process.env.NEXTCLAW_HOME = originalNextclawHome;
  } else {
    delete process.env.NEXTCLAW_HOME;
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("SessionSearchFeatureService", () => {
  it("indexes session labels and assistant text while excluding the current session by default", async () => {
    const { workspace, home } = createTempWorkspace();
    const sessionManager = new SessionManager(workspace);
    const sessionStore = new NextclawAgentSessionStore(sessionManager);

    await sessionStore.saveSession(createSessionRecord({
      sessionId: "current-session",
      label: "Current Thread",
      userText: "deploy checklist for current work",
    }));
    await sessionStore.saveSession(createSessionRecord({
      sessionId: "release-session",
      label: "Release Review",
      userText: "draft release note outline",
      assistantText: "The deploy checklist is ready for production.",
    }));

    const feature = new SessionSearchFeatureService({
      sessionStore,
      databasePath: join(home, "session-search.db"),
    });
    activeFeatures.push(feature);
    await feature.initialize();

    const tool = feature.createTool({ currentSessionId: "current-session" });
    const keywordResult = await tool.execute({ query: "deploy" }) as {
      totalHits: number;
      hits: Array<{ sessionId: string; snippet: string; matchSource: string }>;
    };

    expect(keywordResult.totalHits).toBe(1);
    expect(keywordResult.hits).toHaveLength(1);
    expect(keywordResult.hits[0]).toMatchObject({
      sessionId: "release-session",
      matchSource: "content",
    });
    expect(keywordResult.hits[0]?.snippet).toContain("deploy checklist");

    const labelResult = await tool.execute({ query: "review" }) as {
      hits: Array<{ sessionId: string; matchSource: string; label: string }>;
    };
    expect(labelResult.hits[0]).toMatchObject({
      sessionId: "release-session",
      matchSource: "label",
      label: "Release Review",
    });
  });

  it("can include the current session when explicitly requested", async () => {
    const { workspace, home } = createTempWorkspace();
    const sessionManager = new SessionManager(workspace);
    const sessionStore = new NextclawAgentSessionStore(sessionManager);

    await sessionStore.saveSession(createSessionRecord({
      sessionId: "current-session",
      label: "Current Deploy Thread",
      userText: "deploy issue triage",
    }));
    await sessionStore.saveSession(createSessionRecord({
      sessionId: "past-session",
      label: "Past Deploy Thread",
      assistantText: "deploy rollback notes",
    }));

    const feature = new SessionSearchFeatureService({
      sessionStore,
      databasePath: join(home, "session-search.db"),
    });
    activeFeatures.push(feature);
    await feature.initialize();

    const tool = feature.createTool({ currentSessionId: "current-session" });
    const result = await tool.execute({
      query: "deploy",
      includeCurrentSession: true,
      limit: 10,
    }) as {
      totalHits: number;
      hits: Array<{ sessionId: string }>;
    };

    expect(result.totalHits).toBe(2);
    expect(result.hits.map((hit) => hit.sessionId).sort()).toEqual([
      "current-session",
      "past-session",
    ]);
  });

  it("removes deleted sessions from the derived index and validates tool arguments", async () => {
    const { workspace, home } = createTempWorkspace();
    const sessionManager = new SessionManager(workspace);
    const sessionStore = new NextclawAgentSessionStore(sessionManager);

    await sessionStore.saveSession(createSessionRecord({
      sessionId: "summary-session",
      label: "Weekly Summary",
      assistantText: "Background review summary is complete.",
    }));

    const feature = new SessionSearchFeatureService({
      sessionStore,
      databasePath: join(home, "session-search.db"),
    });
    activeFeatures.push(feature);
    await feature.initialize();

    const tool = feature.createTool({ currentSessionId: "other-session" });
    const issues = tool.validateArgs?.({
      query: "",
      limit: 0,
      includeCurrentSession: "yes",
    });
    expect(issues).toEqual([
      "query must be a non-empty string.",
      "limit must be between 1 and 10.",
      "includeCurrentSession must be a boolean.",
    ]);

    await sessionStore.deleteSession("summary-session");
    await feature.handleSessionUpdated("summary-session");

    const result = await tool.execute({ query: "summary" }) as {
      totalHits: number;
      hits: Array<{ sessionId: string }>;
    };
    expect(result.totalHits).toBe(0);
    expect(result.hits).toEqual([]);
  });
});
