import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { ConfigManager } from "@kernel/managers/config.manager.js";
import { ServiceAppManager } from "@kernel/managers/service-app.manager.js";
import { CapabilityGrantManager } from "@kernel/features/capability-grants/index.js";
import type { ServiceAppManifest, ServiceAppRecord } from "@kernel/types/service-app.types.js";
import type { PortableServiceAppHostCallHandler } from "@kernel/services/portable-service-app-runtime.service.js";

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "nextclaw-service-app-portable-test-"));
}

function createCapabilityGrantManager(): CapabilityGrantManager {
  return new CapabilityGrantManager(join(createTempDir(), "capability-grants.json"));
}

function createConfigManager(workspacePath: string, model?: string): ConfigManager {
  const configPath = join(createTempDir(), "config.json");
  saveConfig(ConfigSchema.parse({ agents: { defaults: { workspace: workspacePath, ...(model ? { model } : {}) } } }), configPath);
  return new ConfigManager({
    configPath,
    channels: { load: vi.fn(), reload: vi.fn() } as never,
    providerManager: { load: vi.fn() } as never,
  });
}

function createRuntime() {
  return {
    getLastObservation: vi.fn(() => undefined),
    getStatus: vi.fn(() => ({ status: "idle" as const })),
    listActions: vi.fn(async () => []),
    invokeAction: vi.fn(async () => ({ ok: true })),
    restart: vi.fn(async () => {}), stop: vi.fn(async () => {}), dispose: vi.fn(async () => {}),
  };
}

describe("ServiceAppManager portable AI host bridge", () => {
  it("reuses granted model/Agent owners for Guest host calls, preserves correlation, and keeps secrets out of responses", async () => {
    let hostCallHandler: PortableServiceAppHostCallHandler | undefined;
    const runtime = {
      ...createRuntime(),
      setPortableHostCallHandler: vi.fn((handler: PortableServiceAppHostCallHandler) => {
        hostCallHandler = handler;
      }),
    };
    const provider = { chat: vi.fn(async () => ({ content: "model-output", usage: { totalTokens: 4 } })) };
    const usage = { observeProviderManager: vi.fn((value) => value) };
    const emitted: string[] = [];
    const execution = {
      handle: { runId: "agent-run-1" },
      events: (async function* () {})(),
      result: Promise.resolve({ handle: { runId: "agent-run-1" }, text: "agent-output", completedMessage: {} }),
      cancel: vi.fn(async () => {}),
      dispose: vi.fn(),
    };
    const agentRunClient = { startRun: vi.fn(async () => execution) };
    const manager = new ServiceAppManager({
      configManager: createConfigManager(createTempDir(), "configured-model"),
      capabilityGrantManager: createCapabilityGrantManager(),
      runtimeService: runtime,
      hasAgent: (id) => id === "review-agent",
      providerManager: provider as never,
      llmUsage: usage as never,
      agentRunClient: agentRunClient as never,
    });
    const app = {
      id: "portable-ai",
      packageId: "example.portable-ai",
      enabled: true,
      protocol: "wasi-component",
      status: "idle",
    } as ServiceAppRecord;
    const manifest = {
      id: app.id,
      title: "Portable AI",
      enabled: true,
      protocol: "wasi-component",
      actions: {},
      requires: {
        modelSlots: [{ id: "summary", title: "Summary", description: "summary", required: true, maxTokens: 24 }],
        agentSlots: [{ id: "review", title: "Review", description: "review", required: true }],
      },
    } as ServiceAppManifest;
    await expect(hostCallHandler).toBeTypeOf("function");
    await expect(hostCallHandler!({
      app, manifest,
      request: {
        kind: "host-call-request", hostCallId: "host-unauthorized", jobId: "job-1", sequence: 1,
        callId: "call-1", traceId: "trace-1", appId: app.id, capability: "model-complete",
        input: { slotId: "summary", messages: [{ role: "user", content: "hello" }] },
      },
      signal: new AbortController().signal,
    })).rejects.toThrow("authorization");

    await manager.aiCapabilities.bindModel(app, manifest, "summary", "configured-model");
    await manager.aiCapabilities.bindAgent(app, manifest, "review", "review-agent");
    const signal = new AbortController();
    const result = await hostCallHandler!({
      app, manifest,
      request: {
        kind: "host-call-request", hostCallId: "host-model", jobId: "job-1", sequence: 1,
        callId: "call-1", traceId: "trace-1", appId: app.id, capability: "model-complete",
        input: { slotId: "summary", messages: [{ role: "user", content: "hello" }], maxTokens: 999 },
      },
      signal: signal.signal,
    });
    expect(result).toEqual({ content: "model-output", usage: { totalTokens: 4 } });
    expect(provider.chat).toHaveBeenCalledWith(expect.objectContaining({ model: "configured-model", maxTokens: 24, signal: signal.signal }));
    expect(usage.observeProviderManager).toHaveBeenCalledWith(provider, "service-app:model-complete");

    const agentResult = await hostCallHandler!({
      app, manifest,
      request: {
        kind: "host-call-request", hostCallId: "host-agent", jobId: "job-1", sequence: 2,
        callId: "call-1", traceId: "trace-1", appId: app.id, capability: "agent-start",
        input: { slotId: "review", input: { message: { role: "user", content: [{ type: "text", text: "review" }] } } },
      },
      signal: signal.signal,
      job: { jobId: "job-1", eventSink: {
        reportProgress: vi.fn(),
        emitChunk: vi.fn(async (value: string) => { emitted.push(value); return {} as never; }),
        recordTerminal: vi.fn(),
      } },
    });
    expect(agentResult).toEqual({ handle: { runId: "agent-run-1" } });
    await vi.waitFor(() => expect(emitted).toHaveLength(1));
    expect(JSON.stringify(emitted)).toContain("agent-result");
    expect(agentRunClient.startRun).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        agent_id: "review-agent",
        parentCorrelationId: "call-1",
        service_app_job_id: "job-1",
        trace_id: "trace-1",
      }),
    }), { abortSignal: signal.signal });
    expect(JSON.stringify({ result, agentResult, emitted })).not.toContain("top-secret");
    signal.abort();
    await vi.waitFor(() => expect(execution.cancel).toHaveBeenCalled());
  });
});
