import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Ingress } from "@nextclaw/shared";
import type { DiagnosticRuntime } from "@nextclaw/core";
import { afterEach, vi } from "vitest";

export const spawnMock = (globalThis as typeof globalThis & { __nextclawExtensionSpawnMock?: ReturnType<typeof vi.fn> }).__nextclawExtensionSpawnMock ?? vi.fn();

export const tempDirs: string[] = [];
export const sessionManager = {} as never;
export function createDiagnostics(): DiagnosticRuntime {
  return { record: vi.fn((event) => event), readCorrelationId: vi.fn(() => undefined) } as unknown as DiagnosticRuntime;
}
export type FakeChildProcess = EventEmitter & {
  pid: number; exitCode: number | null; signalCode: NodeJS.Signals | null; kill: ReturnType<typeof vi.fn>;
};
export function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-kernel-extension-runtime-test-"));
  tempDirs.push(dir);
  return dir;
}
export function createFakeChildProcess(pid: number): FakeChildProcess {
  const child = new EventEmitter() as FakeChildProcess;
  child.pid = pid; child.exitCode = null; child.signalCode = null; child.kill = vi.fn();
  return child;
}
export function readSpawnedExtension(callIndex = spawnMock.mock.calls.length - 1) {
  const [, , options] = spawnMock.mock.calls[callIndex] as unknown as [string, string[], { env: NodeJS.ProcessEnv }];
  const child = spawnMock.mock.results[callIndex]?.value as FakeChildProcess;
  return { extensionId: String(options.env.NEXTCLAW_EXTENSION_ID), generation: String(options.env.NEXTCLAW_EXTENSION_GENERATION), pid: child.pid, token: String(options.env.NEXTCLAW_EXTENSION_TOKEN) };
}
export async function markSpawnedExtensionReady(ingress: Ingress, callIndex?: number) {
  const spawned = readSpawnedExtension(callIndex);
  await ingress.handle({ type: "extension.runtime.ready", extensionId: spawned.extensionId, generation: spawned.generation, payload: { generation: spawned.generation, pid: spawned.pid } }, { source: "test", token: spawned.token });
  return spawned;
}
export function writeExtensionManifest(root: string): void {
  const extensionDir = join(root, "fake-extension");
  mkdirSync(extensionDir);
  writeFileSync(join(extensionDir, "nextclaw.extension.json"), JSON.stringify({
    id: "fake-extension", name: "Fake Extension", server: { type: "stdio", command: "node", args: ["dist/index.js"] },
    contributes: { observations: { read: { description: "Read fake state", configSchema: { type: "object" } }, events: { description: "Watch fake state", configSchema: { type: "object" }, replay: "supported" } }, channels: [{ id: "fake-channel", name: "Fake Channel", description: "Fake channel", auth: true, configSchema: { type: "object" }, configUiHints: { enabled: { label: "Enabled" } } }] },
  }));
}
afterEach(() => {
  vi.useRealTimers(); spawnMock.mockReset();
  while (tempDirs.length) { const dir = tempDirs.pop(); if (dir) rmSync(dir, { recursive: true, force: true }); }
});
