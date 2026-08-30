import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CapabilityGrantManager } from "@kernel/features/capability-grants/index.js";
import { ServiceAppAiCapabilityService } from "./service-app-ai-capability.service.js";

const directories: string[] = [];

function grants(): CapabilityGrantManager {
  const directory = mkdtempSync(join(tmpdir(), "nextclaw-service-app-ai-"));
  directories.push(directory);
  return new CapabilityGrantManager(join(directory, "grants.json"));
}

const app = {
  id: "portable-notes",
  packageId: "example.portable-notes",
} as never;

const manifest = {
  id: "portable-notes",
  requires: {
    modelSlots: [{
      id: "summary", title: "Summary", description: "Summarize a note", required: true,
      maxTokens: 120, timeoutMs: 5_000,
    }],
    agentSlots: [{
      id: "review", title: "Review", description: "Review a note", required: true,
    }],
  },
} as never;

afterEach(() => {
  vi.restoreAllMocks();
  while (directories.length > 0) rmSync(directories.pop()!, { recursive: true, force: true });
});

describe("ServiceAppAiCapabilityService", () => {
  it("fails closed until every required slot has a grant, then calls observed model and Agent owners", async () => {
    const provider = { chat: vi.fn(async () => ({ usage: { totalTokens: 3 }, content: "ok" })) };
    const usage = { observeProviderManager: vi.fn((runtime) => runtime) };
    const cancel = vi.fn(async () => {});
    const agentRunClient = { startRun: vi.fn(async () => ({ cancel })) };
    const service = new ServiceAppAiCapabilityService({
      capabilityGrantManager: grants(),
      hasModel: (model) => model === "gpt-configured",
      hasAgent: (agent) => agent === "main",
      providerManager: provider as never,
      llmUsage: usage as never,
      agentRunClient: agentRunClient as never,
    });

    await expect(service.assertReady(app, manifest)).rejects.toThrow("model:summary, agent:review");
    await expect(service.modelComplete({
      app, manifest, slotId: "summary", messages: [{ role: "user", content: "hi" }], maxTokens: 999,
    })).rejects.toThrow("authorization");

    await service.bindModel(app, manifest, "summary", "gpt-configured");
    await service.bindAgent(app, manifest, "review", "main");
    await expect(service.assertReady(app, manifest)).resolves.toBeUndefined();
    await service.modelComplete({
      app, manifest, slotId: "summary", messages: [{ role: "user", content: "hi" }], maxTokens: 999,
    });
    const execution = await service.agentStart({
      app,
      manifest,
      slotId: "review",
      callId: "call-123",
      jobId: "job-123",
      traceId: "trace-123",
      input: { message: { role: "user", content: [{ type: "text", text: "review" }] } } as never,
    });
    await execution.cancel();

    expect(usage.observeProviderManager).toHaveBeenCalledWith(provider, "service-app:model-complete");
    expect(provider.chat).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-configured", maxTokens: 120 }));
    expect(agentRunClient.startRun).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        agent_id: "main",
        parentCorrelationId: "call-123",
        service_app_id: "example.portable-notes",
        service_component_id: "portable-notes",
        service_app_job_id: "job-123",
        trace_id: "trace-123",
      }),
    }), { abortSignal: undefined });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects unknown model or Agent bindings and invalidates a changed slot declaration", async () => {
    const service = new ServiceAppAiCapabilityService({
      capabilityGrantManager: grants(),
      hasModel: () => false,
      hasAgent: () => false,
    });
    await expect(service.bindModel(app, manifest, "summary", "unknown")).rejects.toThrow("Configured model not found");
    await expect(service.bindAgent(app, manifest, "review", "unknown")).rejects.toThrow("Configured Agent not found");

    const valid = new ServiceAppAiCapabilityService({
      capabilityGrantManager: grants(), hasModel: () => true, hasAgent: () => true,
    });
    await valid.bindModel(app, manifest, "summary", "gpt-configured");
    await valid.bindAgent(app, manifest, "review", "main");
    await expect(valid.inspect(app, {
      ...manifest,
      requires: { ...manifest.requires, modelSlots: [{ ...manifest.requires.modelSlots[0], maxTokens: 121 }] },
    })).resolves.toMatchObject({ ready: false, requiredMissing: [{ kind: "model", slotId: "summary" }] });
  });
});
