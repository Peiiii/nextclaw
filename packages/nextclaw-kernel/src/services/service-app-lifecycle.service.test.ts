import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceAppLifecycleService } from "./service-app-lifecycle.service.js";

const temporaryDirectories: string[] = [];

function component(id: string, mode: "provider" | "resident", providerIds: string[] = []) {
  const directory = mkdtempSync(join(tmpdir(), "nextclaw-service-lifecycle-"));
  temporaryDirectories.push(directory);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "service-app.json"), JSON.stringify({
    id,
    title: id,
    protocol: "wasi-component",
    component: { entry: "service.wasm" },
    lifecycle: mode === "provider" ? { mode } : { mode, eventIntervalMs: 1_000 },
    actions: { status: { risk: "read" } },
  }));
  return {
    id,
    kind: "service" as const,
    sourcePath: directory,
    storage: {} as never,
    resolvedProviderIds: providerIds,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});

describe("ServiceAppLifecycleService", () => {
  it("activates static Providers before their Consumers and deactivates in reverse order", async () => {
    const provider = component("contact-provider", "provider");
    const consumer = component("contact-consumer", "resident", [provider.id]);
    const events: string[] = [];
    const service = new ServiceAppLifecycleService({
      recordService: {
        fromManifest: vi.fn((sourcePath, manifest, source) => ({
          id: manifest.id,
          enabled: true,
          status: "idle",
          providerIds: source.resolvedProviderIds,
          dirPath: sourcePath,
        })),
      } as never,
      runtimeService: {
        start: vi.fn(async ({ app }) => events.push(`start:${app.id}`)),
        stop: vi.fn(async (id) => events.push(`stop:${id}`)),
      },
    });

    await service.activatePackageComponents([consumer, provider] as never);
    await service.deactivatePackageComponents([consumer, provider] as never);

    expect(events).toEqual([
      "start:contact-provider",
      "start:contact-consumer",
      "stop:contact-consumer",
      "stop:contact-provider",
    ]);
  });
});
