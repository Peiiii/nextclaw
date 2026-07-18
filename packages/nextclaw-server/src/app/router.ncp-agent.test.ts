import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { serve } from "@hono/node-server";
import { ConfigSchema, getSkillsPath, getWorkspacePath, saveConfig } from "@nextclaw/core";
import { NcpEventType, type NcpAgentRunSendOptions, type NcpEndpointEvent, type NcpRequestEnvelope, type NcpSessionApi } from "@nextclaw/ncp";
import { createUiRouter } from "./router.js";
import { EventBus, getKeyId, ingressKeys, type IngressEnvelope } from "@nextclaw/shared";
import type { UiKernelHost } from "./types/router-options.types.js";
import { createRouterNcpProjectManager, RouterNcpSessionSettingsStub, writeRouterNcpSkill } from "./tests/router-ncp-test-fixtures.js";

const tempDirs: string[] = [];
const originalHome = process.env.NEXTCLAW_HOME;

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

const createTempConfigPath = (): string => join(createTempDir("nextclaw-ui-ncp-config-"), "config.json");
function useIsolatedHome(): void {
  const isolatedHome = createTempDir("nextclaw-ui-ncp-home-");
  process.env.NEXTCLAW_HOME = isolatedHome;
  vi.stubEnv("HOME", isolatedHome);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  if (typeof originalHome === "string") {
    process.env.NEXTCLAW_HOME = originalHome;
  } else {
    delete process.env.NEXTCLAW_HOME;
  }
  vi.unstubAllEnvs();
});

class StubNcpAgent implements NcpSessionApi {
  private readonly attachmentRootDir = createTempDir("nextclaw-ui-ncp-attachments-");
  private readonly assets = new Map<
    string,
    {
      id: string;
      uri: string;
      storageKey: string;
      fileName: string;
      storedName: string;
      mimeType: string;
      sizeBytes: number;
      createdAt: string;
      sha256: string;
      filePath: string;
    }
  >();
  readonly abortCalls: Array<{ sessionId: string; messageId?: string }> = [];
  readonly runningSessionIds = new Set<string>();
  readonly sessionTypeListCalls: Array<{ describeMode?: "observation" | "probe" } | undefined> = [];
  readonly sessionMetadata = new Map<string, Record<string, unknown>>();
  readonly patchSessionSettings = new RouterNcpSessionSettingsStub(this.sessionMetadata, (sessionId) => this.getSession(sessionId)).patchSessionSettings;
  readonly updateSessionCalls: Array<{
    sessionId: string;
    metadata?: Record<string, unknown> | null;
  }> = [];
  readonly contextWindowBySession = new Map<string, Record<string, unknown>>();
  readonly assetApi = {
    put: async (input: { fileName: string; mimeType?: string | null; bytes: Uint8Array }) => {
      const id = `asset_${this.assets.size + 1}`;
      const storageKey = `2026/03/26/${id}`;
      const uri = `asset://store/${storageKey}`;
      const storedName = input.fileName.replace(/[^\w.-]+/g, "_");
      const filePath = join(this.attachmentRootDir, storedName);
      writeFileSync(filePath, Buffer.from(input.bytes));
      const record = {
        id,
        uri,
        storageKey,
        fileName: input.fileName,
        storedName,
        mimeType: input.mimeType?.trim() || "application/octet-stream",
        sizeBytes: input.bytes.byteLength,
        createdAt: "2026-03-26T00:00:00.000Z",
        sha256: "stub",
        filePath
      };
      this.assets.set(uri, record);
      return record;
    },
    stat: async (uri: string) => {
      const record = this.assets.get(uri);
      if (!record) {
        return null;
      }
      const { filePath, ...rest } = record;
      void filePath;
      return rest;
    },
    resolveContentPath: (uri: string) => this.assets.get(uri)?.filePath ?? null
  };

  send = async () => ({
      sessionId: "session-1",
      userMessageId: "user-message-1",
      assistantMessageId: "assistant-message-1",
    runId: "run-1"
  });

  run = async function* (this: StubNcpAgent, envelope: NcpRequestEnvelope, _options?: NcpAgentRunSendOptions): AsyncGenerator<NcpEndpointEvent> {
    yield {
      type: NcpEventType.RunStarted,
      payload: {
        sessionId: envelope.sessionId,
        messageId: "assistant-message-1",
        runId: "run-1"
      }
    };
    yield {
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: envelope.sessionId,
        messageId: "assistant-message-1",
        runId: "run-1"
      }
    };
  };

  abort = async (payload: { sessionId: string; messageId?: string }): Promise<void> => {
    this.abortCalls.push(payload);
  };

  isSessionRunning = (sessionId: string): boolean => this.runningSessionIds.has(sessionId);

  listSessions = async () => {
    return [
      {
        sessionId: "session-1",
        messageCount: 2,
        updatedAt: "2026-03-17T00:00:00.000Z",
        status: "idle" as const,
        ...(this.sessionMetadata.has("session-1") ? { metadata: this.sessionMetadata.get("session-1") } : {})
      }
    ];
  };

  listSessionMessages = async () => {
    return [
      {
        id: "msg-1",
        sessionId: "session-1",
        role: "user" as const,
        status: "final" as const,
        timestamp: "2026-03-17T00:00:00.000Z",
        parts: [{ type: "text" as const, text: "hello" }]
      }
    ];
  };

  listSessionMessagePage = async (sessionId: string, options: { limit: number; cursor?: string }) => {
    void options;
    if (sessionId !== "session-1") {
      return null;
    }
    return {
      messages: await this.listSessionMessages(),
      total: 1,
      pageInfo: {
        startCursor: "djE6MQ",
        hasPreviousPage: false
      },
      contextWindow: this.contextWindowBySession.get(sessionId) ?? null
    };
  };

  getSession = async (sessionId: string) => {
    if (sessionId !== "session-1" && !this.sessionMetadata.has(sessionId)) {
      return null;
    }
    return {
      sessionId,
      messageCount: sessionId === "session-1" ? 2 : 0,
      updatedAt: "2026-03-17T00:00:00.000Z",
      status: "idle" as const,
      ...(this.sessionMetadata.has(sessionId) ? { metadata: this.sessionMetadata.get(sessionId) } : {}),
      ...(this.contextWindowBySession.has(sessionId) ? { contextWindow: this.contextWindowBySession.get(sessionId) } : {})
    };
  };

  getSessionRecord = async (sessionId: string) => {
    if (sessionId !== "session-1" && !this.sessionMetadata.has(sessionId)) {
      return null;
    }
    return {
      sessionId,
      messages: await this.listSessionMessages(),
      updatedAt: "2026-03-17T00:00:00.000Z",
      ...(this.sessionMetadata.has(sessionId) ? { metadata: this.sessionMetadata.get(sessionId) } : {})
    };
  };

  updateSession = async (sessionId: string, patch: { metadata?: Record<string, unknown> | null }) => {
    this.updateSessionCalls.push({ sessionId, metadata: patch.metadata });
    if (patch.metadata) {
      this.sessionMetadata.set(sessionId, patch.metadata);
    } else {
      this.sessionMetadata.delete(sessionId);
    }
    return {
      sessionId,
      messageCount: sessionId === "session-1" ? 2 : 0,
      updatedAt: "2026-03-17T00:00:00.000Z",
      status: "idle" as const,
      ...(patch.metadata ? { metadata: patch.metadata } : {})
    };
  };

  setSessionMetadata = async (sessionId: string, metadata: Record<string, unknown>): Promise<boolean> => {
    this.sessionMetadata.set(sessionId, structuredClone(metadata));
    return true;
  };

  updateSessionMetadata = async (sessionId: string, metadata: Record<string, unknown>): Promise<boolean> => {
    this.sessionMetadata.set(sessionId, {
      ...(this.sessionMetadata.get(sessionId) ?? {}),
      ...structuredClone(metadata)
    });
    return true;
  };

  deleteSession = async (): Promise<void> => {};

  listSessionTypes = async (params?: { describeMode?: "observation" | "probe" }) => {
    this.sessionTypeListCalls.push(params);
    return {
      defaultType: "native",
      options: [
        { value: "native", label: "Native" },
        { value: "codex", label: "Codex" }
      ]
    };
  };
}

function createTestKernel(agent: StubNcpAgent): UiKernelHost {
  return {
    listSessionTypes: agent.listSessionTypes,
    isSessionRunning: agent.isSessionRunning,
    assetStore: {
      putBytes: agent.assetApi.put,
      statRecord: agent.assetApi.stat,
      resolveContentPath: agent.assetApi.resolveContentPath
    },
    ingress: {
      handle: async (envelope: IngressEnvelope) => {
        switch (getKeyId(envelope.type)) {
          case getKeyId(ingressKeys.agentRun.send):
            return await agent.send();
          case getKeyId(ingressKeys.agentRun.abort):
            await agent.abort(envelope.payload as { sessionId: string; messageId?: string });
            return undefined;
          default:
            throw new Error(`Unsupported test ingress type: ${getKeyId(envelope.type)}`);
        }
      }
    },
    eventBus: new EventBus(),
    sessionManager: agent,
    projectManager: createRouterNcpProjectManager(createTempDir("nextclaw-ui-project-store-")),
    llmProviders: {}
  } as unknown as UiKernelHost;
}

function createTestApp(): {
  app: ReturnType<typeof createUiRouter>;
  agent: StubNcpAgent;
} {
  useIsolatedHome();
  const configPath = join(createTempDir("nextclaw-ui-ncp-config-"), "config.json");
  saveConfig(ConfigSchema.parse({}), configPath);
  const agent = new StubNcpAgent();
  return {
    agent,
    app: createUiRouter({
      configPath,
      appEventBus: new EventBus(),
      kernel: createTestKernel(agent)
    })
  };
}

async function requestNodeRawHeaders(app: ReturnType<typeof createUiRouter>, path: string): Promise<string[]> {
  const server = serve({
    fetch: app.fetch,
    port: 0,
    hostname: "127.0.0.1"
  });

  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected an ephemeral TCP address for test server.");
    }

    return await new Promise<string[]>((resolve, reject) => {
      const request = http.request(
        {
          host: "127.0.0.1",
          port: address.port,
          path
        },
        (response) => {
          response.resume();
          response.once("end", () => resolve(response.rawHeaders));
        }
      );

      request.once("error", reject);
      request.end();
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

it("mounts parallel ncp agent and session routes", async () => {
  const { app, agent } = createTestApp();

  const sessionsResponse = await app.request("http://localhost/api/ncp/sessions");
  expect(sessionsResponse.status).toBe(200);
  const sessionsPayload = (await sessionsResponse.json()) as {
    ok: boolean;
    data: {
      total: number;
      sessions: Array<{ sessionId: string }>;
    };
  };
  expect(sessionsPayload.ok).toBe(true);
  expect(sessionsPayload.data.total).toBe(1);
  expect(sessionsPayload.data.sessions[0]?.sessionId).toBe("session-1");

  const sessionTypesResponse = await app.request("http://localhost/api/ncp/session-types");
  expect(sessionTypesResponse.status).toBe(200);
  const sessionTypesPayload = (await sessionTypesResponse.json()) as {
    ok: boolean;
    data: {
      defaultType: string;
      options: Array<{ value: string; label: string }>;
    };
  };
  expect(sessionTypesPayload.ok).toBe(true);
  expect(sessionTypesPayload.data).toEqual({
    defaultType: "native",
    options: [
      { value: "native", label: "Native" },
      { value: "codex", label: "Codex" }
    ]
  });
  expect(agent.sessionTypeListCalls).toEqual([{ describeMode: "observation" }]);
});

it("includes a derived context window snapshot in the session messages seed", async () => {
  const { app, agent } = createTestApp();
  agent.contextWindowBySession.set("session-1", {
    usedContextTokens: 42,
    totalContextTokens: 1000,
    prunedUsedContextTokens: 42,
    availableContextTokens: 958,
    droppedHistoryCount: 0,
    truncatedToolResultCount: 0,
    truncatedSystemPrompt: false,
    truncatedUserMessage: false,
    compacted: false,
    compactedMessageCount: 0,
    updatedAt: "session-1:now"
  });

  const messagesResponse = await app.request("http://localhost/api/ncp/sessions/session-1/messages");
  const messagesPayload = (await messagesResponse.json()) as {
    ok: boolean;
    data: {
      contextWindow?: {
        usedContextTokens: number;
        totalContextTokens: number;
        updatedAt: string;
      };
    };
  };

  expect(messagesPayload.ok).toBe(true);
  expect(messagesPayload.data.contextWindow).toMatchObject({
    usedContextTokens: 42,
    totalContextTokens: 1000,
    updatedAt: "session-1:now"
  });
});

it("hydrates ncp session reads with kernel runtime status", async () => {
  const { app, agent } = createTestApp();
  agent.runningSessionIds.add("session-1");

  const sessionsPayload = (await (await app.request("http://localhost/api/ncp/sessions")).json()) as {
    data: { sessions: Array<{ sessionId: string; status: string }> };
  };
  const sessionPayload = (await (await app.request("http://localhost/api/ncp/sessions/session-1")).json()) as {
    data: { sessionId: string; status: string };
  };
  const messagesPayload = (await (await app.request("http://localhost/api/ncp/sessions/session-1/messages")).json()) as {
    data: { status: string };
  };

  expect(sessionsPayload.data.sessions[0]).toMatchObject({
    sessionId: "session-1",
    status: "running"
  });
  expect(sessionPayload.data).toMatchObject({
    sessionId: "session-1",
    status: "running"
  });
  expect(messagesPayload.data.status).toBe("running");
});

it("keeps session routes readable through the kernel session api", async () => {
  useIsolatedHome();
  const configPath = createTempConfigPath();
  saveConfig(ConfigSchema.parse({}), configPath);
  const sessionService = new StubNcpAgent();
  const app = createUiRouter({
    configPath,
    appEventBus: new EventBus(),
    kernel: createTestKernel(sessionService)
  });

  const sessionsResponse = await app.request("http://localhost/api/ncp/sessions");
  expect(sessionsResponse.status).toBe(200);
  const sessionsPayload = (await sessionsResponse.json()) as {
    ok: boolean;
    data: {
      total: number;
      sessions: Array<{ sessionId: string }>;
    };
  };
  expect(sessionsPayload.ok).toBe(true);
  expect(sessionsPayload.data.sessions[0]?.sessionId).toBe("session-1");

  const sessionTypesResponse = await app.request("http://localhost/api/ncp/session-types");
  expect(sessionTypesResponse.status).toBe(200);
  const sessionTypesPayload = (await sessionTypesResponse.json()) as {
    ok: boolean;
    data: {
      defaultType: string;
      options: Array<{ value: string; label: string }>;
    };
  };
  expect(sessionTypesPayload.ok).toBe(true);
  expect(sessionTypesPayload.data).toEqual({
    defaultType: "native",
    options: [
      { value: "native", label: "Native" },
      { value: "codex", label: "Codex" }
    ]
  });
  expect(sessionService.sessionTypeListCalls).toEqual([{ describeMode: "observation" }]);
});

it("stores uploaded ncp assets and serves their content back", async () => {
  const { app } = createTestApp();

  const formData = new FormData();
  formData.append(
    "files",
    new File(['{"hello":"world"}'], "config.json", {
      type: "application/json"
    })
  );
  const uploadResponse = await app.request("http://localhost/api/ncp/assets", {
    method: "POST",
    body: formData
  });
  expect(uploadResponse.status).toBe(200);
  const uploadPayload = (await uploadResponse.json()) as {
    ok: boolean;
    data: {
      assets: Array<{
        name: string;
        assetUri: string;
        url: string;
      }>;
    };
  };
  expect(uploadPayload.ok).toBe(true);
  expect(uploadPayload.data.assets[0]?.name).toBe("config.json");
  expect(uploadPayload.data.assets[0]?.assetUri).toContain("asset://store/");

  const contentResponse = await app.request(`http://localhost${uploadPayload.data.assets[0]?.url}`);
  expect(contentResponse.status).toBe(200);
  expect(await contentResponse.text()).toBe('{"hello":"world"}');
});

it("serves uploaded ncp assets through node http without duplicate content-length headers", async () => {
  const { app } = createTestApp();

  const formData = new FormData();
  formData.append(
    "files",
    new File(['{"hello":"world"}'], "config.json", {
      type: "application/json"
    })
  );
  const uploadResponse = await app.request("http://localhost/api/ncp/assets", {
    method: "POST",
    body: formData
  });
  const uploadPayload = (await uploadResponse.json()) as {
    ok: boolean;
    data: {
      assets: Array<{
        url: string;
      }>;
    };
  };

  const rawHeaders = await requestNodeRawHeaders(app, uploadPayload.data.assets[0]!.url);
  const contentLengthHeaderCount = rawHeaders.reduce((count, entry, index) => {
    if (index % 2 === 0 && entry.toLowerCase() === "content-length") {
      return count + 1;
    }
    return count;
  }, 0);

  expect(contentLengthHeaderCount).toBe(1);
});

it("proxies ncp send, patch, and abort flows", async () => {
  const { app, agent } = createTestApp();
  const validProjectRoot = realpathSync(createTempDir("nextclaw-ui-ncp-project-root-"));

  const patchResponse = await app.request("http://localhost/api/ncp/sessions/session-1", {
    method: "PUT",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      preferredModel: "openai/gpt-5",
      preferredThinking: "medium",
      projectRoot: validProjectRoot,
      uiReadAt: "2026-03-17T00:00:00.000Z"
    })
  });
  expect(patchResponse.status).toBe(200);
  const patchPayload = (await patchResponse.json()) as {
    ok: boolean;
    data: {
      metadata?: Record<string, unknown>;
    };
  };
  expect(patchPayload.ok).toBe(true);
  expect(patchPayload.data.metadata).toMatchObject({
    preferred_model: "openai/gpt-5",
    preferred_thinking: "medium",
    project_root: validProjectRoot,
    ui_last_read_at: "2026-03-17T00:00:00.000Z"
  });
  expect(agent.updateSessionCalls).toEqual([]);
  const sendResponse = await app.request("http://localhost/api/ncp/agent/send", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sessionId: "session-1",
      message: {
        id: "user-message-1",
        sessionId: "session-1",
        role: "user",
        status: "final",
        timestamp: "2026-03-17T00:00:00.000Z",
        parts: [{ type: "text", text: "hello" }]
      }
    })
  });
  expect(sendResponse.status).toBe(200);
  expect(sendResponse.headers.get("content-type")).toContain("application/json");
  await expect(sendResponse.json()).resolves.toEqual({
    ok: true,
    data: {
      sessionId: "session-1",
      userMessageId: "user-message-1",
      assistantMessageId: "assistant-message-1",
      runId: "run-1"
    }
  });

  const abortResponse = await app.request("http://localhost/api/ncp/agent/abort", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sessionId: "session-1"
    })
  });
  expect(abortResponse.status).toBe(200);
  expect(agent.abortCalls).toEqual([{ sessionId: "session-1" }]);
});

it("rejects invalid session project roots during patch", async () => {
  const { app } = createTestApp();

  const patchResponse = await app.request("http://localhost/api/ncp/sessions/session-1", {
    method: "PUT",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      projectRoot: "/path/that/does/not/exist"
    })
  });

  expect(patchResponse.status).toBe(400);
  const patchPayload = (await patchResponse.json()) as {
    ok: boolean;
    error: {
      code: string;
      message: string;
    };
  };
  expect(patchPayload.ok).toBe(false);
  expect(patchPayload.error).toEqual({
    code: "PROJECT_ROOT_NOT_FOUND",
    message: "projectRoot directory does not exist"
  });
});

it("clears both canonical and legacy project root metadata keys", async () => {
  const { app, agent } = createTestApp();
  agent.sessionMetadata.set("session-1", {
    project_root: "/tmp/project-alpha",
    projectRoot: "/tmp/project-alpha"
  });

  const patchResponse = await app.request("http://localhost/api/ncp/sessions/session-1", {
    method: "PUT",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      projectRoot: null
    })
  });

  expect(patchResponse.status).toBe(200);
  const patchPayload = (await patchResponse.json()) as {
    ok: boolean;
    data: {
      metadata?: Record<string, unknown>;
    };
  };
  expect(patchPayload.ok).toBe(true);
  expect(patchPayload.data.metadata).toEqual({});
  expect(agent.sessionMetadata.get("session-1")).toEqual({});
});

it("exposes session-scoped skills for persisted and draft sessions", async () => {
  useIsolatedHome();
  const configPath = createTempConfigPath();
  const hostWorkspace = createTempDir("nextclaw-ui-host-workspace-");
  const projectRoot = realpathSync(createTempDir("nextclaw-ui-session-project-"));
  const globalSkillsRoot = join(process.env.HOME!, ".agents", "skills");
  writeRouterNcpSkill(join(hostWorkspace, "skills", "shared-review"), "Workspace review");
  writeRouterNcpSkill(join(projectRoot, ".agents", "skills", "shared-review"), "Project review");
  writeRouterNcpSkill(join(globalSkillsRoot, "global-review"), "Global review");
  saveConfig(
    ConfigSchema.parse({
    agents: {
      defaults: {
          workspace: hostWorkspace
        }
      }
    }),
    configPath
  );

  const agent = new StubNcpAgent();
  agent.sessionMetadata.set("session-1", { project_root: projectRoot });
  const app = createUiRouter({
    configPath,
    appEventBus: new EventBus(),
    kernel: createTestKernel(agent)
  });

  const response = await app.request("http://localhost/api/ncp/sessions/session-1/skills");
  expect(response.status).toBe(200);
  const payload = (await response.json()) as {
    ok: boolean;
    data: {
      sessionId: string;
      records: Array<{
        ref: string;
        name: string;
        scope: string;
      }>;
    };
  };
  expect(payload.ok).toBe(true);
  expect(payload.data.sessionId).toBe("session-1");
  expect(payload.data.records).toEqual(
    expect.arrayContaining([
    expect.objectContaining({
      name: "shared-review",
      scope: "project",
        ref: `project:${join(projectRoot, ".agents", "skills", "shared-review")}`
    }),
    expect.objectContaining({
      name: "shared-review",
      scope: "workspace",
        ref: `workspace:${join(hostWorkspace, "skills", "shared-review")}`
    }),
    expect.objectContaining({
      name: "global-review",
        scope: "global"
      })
    ])
  );

  const draftResponse = await app.request(`http://localhost/api/ncp/sessions/draft-session/skills?projectRoot=${encodeURIComponent(projectRoot)}`);
  expect(draftResponse.status).toBe(200);
  const draftPayload = (await draftResponse.json()) as {
    ok: boolean;
    data: {
      records: Array<{ scope: string }>;
    };
  };
  expect(draftPayload.ok).toBe(true);
  expect(draftPayload.data.records.some((record) => record.scope === "project")).toBe(true);
});

it("exposes draft session skills without requiring an empty projectRoot override", async () => {
  useIsolatedHome();
  const configPath = createTempConfigPath();
  const hostWorkspace = createTempDir("nextclaw-ui-host-workspace-");
  mkdirSync(join(hostWorkspace, "skills", "workspace-only-skill"), {
    recursive: true
  });
  writeFileSync(
    join(hostWorkspace, "skills", "workspace-only-skill", "SKILL.md"),
    ["---", "name: workspace-only-skill", "description: Workspace only", "---"].join("\n")
  );
  saveConfig(
    ConfigSchema.parse({
    agents: {
      defaults: {
          workspace: hostWorkspace
        }
      }
    }),
    configPath
  );

  const agent = new StubNcpAgent();
  const app = createUiRouter({
    configPath,
    appEventBus: new EventBus(),
    kernel: createTestKernel(agent)
  });

  const response = await app.request("http://localhost/api/ncp/sessions/draft-session/skills");
  expect(response.status).toBe(200);
  const payload = (await response.json()) as {
    ok: boolean;
    data: {
      sessionId: string;
      records: Array<{
        name: string;
        scope: string;
      }>;
    };
  };
  expect(payload.ok).toBe(true);
  expect(payload.data.sessionId).toBe("draft-session");
  expect(payload.data.records).toEqual(
    expect.arrayContaining([
    expect.objectContaining({
      name: "workspace-only-skill",
        scope: "workspace"
      })
    ])
  );
});

it("exposes skills installed in the NEXTCLAW_HOME default workspace", async () => {
  useIsolatedHome();
  const configPath = createTempConfigPath();
  const skillsRoot = getSkillsPath(getWorkspacePath());
  mkdirSync(join(skillsRoot, "portable-skill"), { recursive: true });
  writeFileSync(join(skillsRoot, "portable-skill", "SKILL.md"), ["---", "name: portable-skill", "description: Portable workspace", "---"].join("\n"));
  saveConfig(ConfigSchema.parse({}), configPath);

  const agent = new StubNcpAgent();
  const app = createUiRouter({
    configPath,
    appEventBus: new EventBus(),
    kernel: createTestKernel(agent)
  });

  const response = await app.request("http://localhost/api/ncp/sessions/draft-session/skills");
  expect(response.status).toBe(200);
  const payload = (await response.json()) as {
    ok: boolean;
    data: {
      records: Array<{
        name: string;
        ref: string;
        scope: string;
      }>;
    };
  };
  expect(payload.ok).toBe(true);
  expect(payload.data.records).toEqual(
    expect.arrayContaining([
    expect.objectContaining({
      name: "portable-skill",
      scope: "workspace",
        ref: `workspace:${join(skillsRoot, "portable-skill")}`
      })
    ])
  );
});

it("creates a lightweight session when patching a draft session", async () => {
  const { app } = createTestApp();
  const validProjectRoot = realpathSync(createTempDir("nextclaw-ui-draft-project-root-"));

  const patchResponse = await app.request("http://localhost/api/ncp/sessions/draft-session-1", {
    method: "PUT",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      projectRoot: validProjectRoot,
      sessionType: "codex"
    })
  });

  expect(patchResponse.status).toBe(200);
  const patchPayload = (await patchResponse.json()) as {
    ok: boolean;
    data: {
      sessionId: string;
      messageCount: number;
      metadata?: Record<string, unknown>;
    };
  };
  expect(patchPayload.ok).toBe(true);
  expect(patchPayload.data).toMatchObject({
    sessionId: "draft-session-1",
    messageCount: 0,
    metadata: {
      project_root: validProjectRoot,
      session_type: "codex"
    }
  });
});

it("serves legacy octet-stream audio assets with an inferred media content-type", async () => {
  const { app, agent } = createTestApp();
  const record = await agent.assetApi.put({
    fileName: "chill_beats.mp3",
    mimeType: "application/octet-stream",
    bytes: new Uint8Array(Buffer.from("fake-mp3", "utf8"))
  });

  const response = await app.request(`http://localhost/api/ncp/assets/content?uri=${encodeURIComponent(record.uri)}`);

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("audio/mpeg");
  expect(response.headers.get("content-disposition")).toContain("inline;");
});
