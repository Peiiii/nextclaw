import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentKernel } from "@kernel/managers/agent-kernel.manager.js";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { ingressKeys } from "@nextclaw/shared";
import { NodePlatform } from "./node-platform.service.js";
import { NextclawHarness } from "@kernel/features/harness/managers/nextclaw-harness.manager.js";
import { Contribution } from "@kernel/features/harness/managers/nextclaw-contribution.manager.js";
import { LocalWorkspaceStore } from "@kernel/stores/local-workspace.store.js";
import { createWorkspaceByteTools } from "@kernel/tools/workspace-byte.tools.js";

class FileContribution extends Contribution {
  constructor(private readonly workspace: string) { super({ id: "local-files" }); }
  protected setup = (): void => {
    for (const tool of createWorkspaceByteTools(new LocalWorkspaceStore(this.workspace))) {
      this.effect(() => this.kernel.tools.register(tool));
    }
  };
}

class StartupProbeContribution extends Contribution {
  constructor() { super({ id: "startup-probe" }); }
  protected setup = async (): Promise<void> => {
    await expect(this.kernel.ingress.handle({
      type: ingressKeys.agentRun.sessionMessageRequest,
    }, { source: "startup-probe" })).rejects.toThrow("Unsupported ingress type");
  };
}

async function modelServer() {
  const requests: Array<{ model: string; messages: Array<{ role: string; content: unknown }> }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    requests.push(JSON.parse(Buffer.concat(chunks).toString()));
    const tool = requests.length === 1;
    const delta = tool ? { role: "assistant", tool_calls: [{ index: 0, id: "read-local", type: "function",
      function: { name: "read_file", arguments: JSON.stringify({ path: "sample.txt" }) } }] }
      : { role: "assistant", content: requests.length === 2 ? "read complete" : "history restored" };
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(`data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", created: 1,
      model: "gpt-4o", choices: [{ index: 0, delta, finish_reason: tool ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("HTTP fixture did not bind");
  return { requests, url: `http://127.0.0.1:${address.port}/v1`,
    close: async () => { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); } };
}

describe("NodePlatform through the public Harness", () => {
  it("rolls back product readiness and contribution effects before retrying the same Harness", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "nextclaw-module-retry-"));
    saveConfig(ConfigSchema.parse({ agents: { defaults: { workspace: join(homeDir, "workspace") } } }), join(homeDir, "config.json"));
    const calls: string[] = [];
    let engine: AgentKernel | undefined;
    let readiness = 0;
    class ScopedContext extends Contribution {
      constructor() { super({ id: "retry-context" }); }
      protected setup = (): void => {
        this.effect(() => {
          calls.push("context:start");
          const remove = this.kernel.context.register({ provide: () => ["MODULE_CONTEXT"] });
          return () => { remove(); calls.push("context:stop"); };
        });
      };
    }
    const harness = new NextclawHarness({ platform: new NodePlatform({ homeDir, sessionSearchEnabled: false }), modules: [{
      attach: (kernel) => { engine = kernel; calls.push("attach"); },
      start: async () => { calls.push("start"); },
      ready: async () => { if (++readiness === 1) throw new Error("readiness fixture"); },
      stop: async () => { calls.push("stop"); if (readiness === 1) throw new Error("stop fixture"); },
      dispose: async () => { calls.push("dispose"); },
    }] });
    harness.contributions.register(new ScopedContext());
    try {
      await harness.prepare();
      await expect(engine!.ingress.handle({ type: ingressKeys.agentRun.sessionMessageRequest },
        { source: "prepared" })).rejects.toThrow("Unsupported ingress type");
      const starts = await Promise.allSettled([harness.start(), harness.start()]);
      expect(starts.map((result) => result.status)).toEqual(["rejected", "rejected"]);
      expect(calls).toEqual(["attach", "start", "context:start", "context:stop", "stop", "dispose"]);
      await harness.start();
      const context = await engine!.contextProviderManager.buildContext({ message: {
        id: "context", sessionId: "context", role: "user", status: "final", parts: [], timestamp: new Date().toISOString(),
      } });
      expect(context.filter((block) => block === "MODULE_CONTEXT")).toHaveLength(1);
      await harness.dispose();
      await harness.dispose();
      expect(calls.filter((call) => call === "dispose")).toHaveLength(2);
      expect(calls.filter((call) => call === "context:stop")).toHaveLength(2);
    } finally { await harness.dispose(); await rm(homeDir, { recursive: true, force: true }); }
  });

  it("uses local tools and prompts, persists the conversation and resumes from disk", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "nextclaw-node-platform-"));
    const upstream = await modelServer();
    const workspace = join(homeDir, "workspace");
    await mkdir(workspace);
    await writeFile(join(workspace, "AGENTS.md"), "LOCAL_BOOTSTRAP_RULE");
    await writeFile(join(workspace, "sample.txt"), "REAL_FILE_CONTENT");
    saveConfig(ConfigSchema.parse({ agents: { defaults: { workspace, model: "openai/gpt-4o" } },
      providers: { openai: { apiKey: "test-key", apiBase: upstream.url, wireApi: "chat" } } }), join(homeDir, "config.json"));
    const options = { homeDir, sessionSearchEnabled: false, sessionTitleEnabled: false };
    const platform = new NodePlatform(options);
    let harness = new NextclawHarness({ platform });
    try {
      const resources = await Promise.all([platform.start(), platform.start()]);
      expect(resources[0]).toBe(resources[1]);
      harness.contributions.register(new FileContribution(workspace));
      harness.contributions.register(new StartupProbeContribution());
      await harness.start();
      const first = await harness.runTask({ sessionId: "persisted", input: "read sample.txt", signal: AbortSignal.timeout(10_000) });
      expect(first.text).toBe("read complete");
      expect(upstream.requests).toHaveLength(2);
      expect(upstream.requests[0]?.model).toBe("gpt-4o");
      expect(JSON.stringify(upstream.requests[0]?.messages)).toContain("LOCAL_BOOTSTRAP_RULE");
      expect(JSON.stringify(upstream.requests[1]?.messages.filter((message) => message.role === "tool"))).toContain("REAL_FILE_CONTENT");
      await harness.dispose();
      harness = new NextclawHarness({ platform: new NodePlatform(options) });
      await harness.start();
      const second = await harness.runTask({ sessionId: "persisted", input: "continue", signal: AbortSignal.timeout(10_000) });
      expect(second.text).toBe("history restored");
      expect(JSON.stringify(upstream.requests[2]?.messages)).toContain("REAL_FILE_CONTENT");
      expect((await harness.listSessionMessages("persisted")).filter((message) => message.role === "user")).toHaveLength(2);
      expect(await readFile(join(workspace, "sample.txt"), "utf-8")).toBe("REAL_FILE_CONTENT");
    } finally {
      await harness.dispose();
      await platform.dispose();
      await upstream.close();
      await rm(homeDir, { recursive: true, force: true });
    }
  }, 20_000);

  it("releases a failed initialization and can retry without replacing user data", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "nextclaw-node-retry-"));
    saveConfig(ConfigSchema.parse({ agents: { defaults: { workspace: join(homeDir, "workspace") } } }), join(homeDir, "config.json"));
    const database = join(homeDir, "projects", "work-items.db");
    await mkdir(database, { recursive: true });
    const harness = new NextclawHarness({ platform: new NodePlatform({ homeDir, sessionSearchEnabled: false }) });
    try {
      await expect(harness.start()).rejects.toThrow("Harness failed to start");
      await rm(database, { recursive: true });
      await harness.start();
      expect(harness.agents.get().id).toBe("main");
      await harness.dispose();
      await harness.dispose();
      expect(JSON.parse(await readFile(join(homeDir, "config.json"), "utf-8")).agents.defaults.workspace).toBe(join(homeDir, "workspace"));
    } finally { await harness.dispose(); await rm(homeDir, { recursive: true, force: true }); }
  });
});
