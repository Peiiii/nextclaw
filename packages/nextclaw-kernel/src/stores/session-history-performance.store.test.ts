import { mkdtemp, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { NcpAgentSessionMessageProjectionPersistenceStore } from "./ncp-agent-session-message-projection-persistence.store.js";
import { SessionMessageSqlProjectionStore } from "./session-message-sql-projection.store.js";
import { openSqliteDatabase, type SqliteDatabase } from "./sqlite-database.store.js";
import { ContextCompactionPreflightService } from "@kernel/features/context-compaction/services/context-compaction-preflight.service.js";
import { SessionRun } from "@kernel/managers/session-run.manager.js";

const enabled = process.env.NEXTCLAW_HISTORY_BENCHMARK === "1";
const count = Math.max(30, Number(process.env.NEXTCLAW_HISTORY_BENCHMARK_RUNS ?? 30));
const id = "benchmark";
const timestamp = "2026-10-19T00:00:00.000Z";
type Sample = { ms: number; logicalReadBytes: number; heapGrowth: number; responseBytes: number };
function percentile(values: number[], fraction: number) { return [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)]!; }
function metrics(samples: Sample[]) {
  const summary = (key: keyof Sample) => ({ p50: percentile(samples.map(value => value[key]), .5), p95: percentile(samples.map(value => value[key]), .95), max: Math.max(...samples.map(value => value[key])) });
  return { samples: samples.length, ms: summary("ms"), logicalReadBytes: summary("logicalReadBytes"), heapGrowth: summary("heapGrowth"), responseBytes: summary("responseBytes") };
}
async function rawFixture(directory: string, messages: number, bodyBytes: number, deltas = 0) {
  const file = await open(join(directory, `${id}.jsonl`), "w");
  try {
    for (let index = 0; index < messages; index++) {
      const message: NcpMessage = { id: `m-${index}`, sessionId: id, role: deltas ? "assistant" : "user", status: deltas ? "streaming" : "final", timestamp, parts: [{ type: "text", text: "" }] };
      const event = { _type: "event", version: 1, seq: index + 1, event: { type: NcpEventType.MessageSent, payload: { sessionId: id, message } } };
      const encoded = JSON.stringify(event); const split = encoded.indexOf('"text":""') + '"text":"'.length;
      await file.writeFile(encoded.slice(0, split));
      const chunk = "x".repeat(8_192);
      for (let bytes = 0; bytes < bodyBytes; bytes += chunk.length) await file.writeFile(chunk.slice(0, Math.min(chunk.length, bodyBytes - bytes)));
      await file.writeFile(encoded.slice(split) + "\n");
    }
    if (deltas) {
      const line = JSON.stringify({ _type: "event", version: 1, event: { type: NcpEventType.MessageTextDelta,
        payload: { sessionId: id, messageId: "m-0", delta: "x" } } }) + "\n";
      for (let index = 0; index < deltas; index += 256) await file.writeFile(line.repeat(Math.min(256, deltas - index)));
    }
    await file.sync();
  } finally { await file.close(); }
}
async function processIo() {
  if (process.platform !== "linux") return null;
  const text = await readFile("/proc/self/io", "utf8");
  return Object.fromEntries(text.trim().split("\n").map(line => { const [key, value] = line.split(":"); return [key, Number(value)]; }));
}

describe.skipIf(!enabled)("bounded history performance contract", () => {
  for (const scenario of [
    { name: "256MiB-history", messages: 4_096, body: 64 * 1024, deltas: 0 },
    { name: "64MiB-single-message", messages: 1, body: 64 * 1024 * 1024, deltas: 0 },
    { name: "million-tiny-deltas", messages: 1, body: 0, deltas: 1_000_000 },
  ]) it(scenario.name, async () => {
    const directory = await mkdtemp(join(tmpdir(), "history-performance-"));
    try {
      await rawFixture(directory, scenario.messages, scenario.body, scenario.deltas);
      const sourceBytes = (await stat(join(directory, `${id}.jsonl`))).size;
      const store = new NcpAgentSessionMessageProjectionPersistenceStore(directory);
      global.gc?.();
      const baseline = process.memoryUsage(); let peakHeap = baseline.heapUsed; let peakRss = baseline.rss;
      const sampler = setInterval(() => { const memory = process.memoryUsage(); peakHeap = Math.max(peakHeap, memory.heapUsed); peakRss = Math.max(peakRss, memory.rss); }, 5);
      const delay = monitorEventLoopDelay({ resolution: 10 }); delay.enable();
      const ioBefore = await processIo(); const start = performance.now();
      await store.prepare(id);
      const repairMs = performance.now() - start;
      clearInterval(sampler); const ioAfter = await processIo(); delay.disable();
      const databasePath = join(directory, ".message-projections", id, "messages.sqlite");
      let logicalReadBytes = 0;
      const measured = new SessionMessageSqlProjectionStore({
        journalBytes: async () => sourceBytes, journalIdentity: () => store.journalIdentity(id), delete: async () => {}, transaction: async operation => operation(),
        database: async () => {
          const database = await openSqliteDatabase(databasePath, { incremental: true });
          const wrap = (value: unknown) => { logicalReadBytes += Buffer.byteLength(JSON.stringify(value) ?? ""); return value; };
          return { ...database, close: () => database.close(), exec: value => database.exec(value), prepare: query => {
            const statement = database.prepare(query);
            return { run: (...args) => statement.run(...args), get: (...args) => wrap(statement.get(...args)), all: (...args) => wrap(statement.all(...args)) as unknown[] };
          } } as SqliteDatabase;
        },
      });
      const page: Sample[] = []; const part: Sample[] = []; const window: Sample[] = []; const planning: Sample[] = [];
      const sample = async (target: Sample[], operation: () => Promise<unknown>) => {
        global.gc?.(); const memory = process.memoryUsage().heapUsed; logicalReadBytes = 0; const time = performance.now();
        const value = await operation(); const ms = performance.now() - time;
        target.push({ ms, logicalReadBytes, heapGrowth: Math.max(0, process.memoryUsage().heapUsed - memory), responseBytes: value === undefined ? 0 : Buffer.byteLength(JSON.stringify(value)) });
      };
      const preflight = new ContextCompactionPreflightService({ resolveAgentProfileForRun: () => ({ contextTokens: 128_000, reservedContextTokens: 16_000 }) }, { chat: async () => { throw new Error("A performance plan must not call a model."); } });
      let seed: NcpMessage[] = [];
      for (let repeat = 0; repeat < count; repeat++) {
        await sample(page, () => measured.listPage({ sessionId: id, limit: 40 }));
        await sample(part, () => measured.readPart(id, "m-0", 0));
        await sample(window, async () => { seed = (await measured.readRunWindow(id))!.messages; const run = new SessionRun({ sessionId: id, messages: seed }); run.dispose(); });
        await sample(planning, async () => {
          preflight.begin({ sessionId: id, inputMessages: [], sessionMessages: seed, model: "test", requestMetadata: {}, storedMetadata: {} });
        });
      }
      const report = { scenario: scenario.name, environment: { node: process.version, platform: process.platform, arch: process.arch, processCold: false, sqliteConnectionsCold: true, osPageCache: "warm" },
        sourceBytes, indexBytes: (await stat(databasePath)).size, repair: { ms: repairMs, heapGrowth: peakHeap - baseline.heapUsed, rssGrowth: peakRss - baseline.rss,
          eventLoopP95Ms: delay.percentile(95) / 1e6, eventLoopMaxMs: delay.max / 1e6, ioBefore, ioAfter }, page: metrics(page), part: metrics(part), window: metrics(window), planning: metrics(planning) };
      console.log("HISTORY_PERFORMANCE", JSON.stringify(report));
      if (process.env.NEXTCLAW_HISTORY_BENCHMARK_OUTPUT) await writeFile(join(process.env.NEXTCLAW_HISTORY_BENCHMARK_OUTPUT, `${scenario.name}.json`), JSON.stringify(report, null, 2));
      expect(report.page.responseBytes.max).toBeLessThanOrEqual(256 * 1024);
      expect(report.page.logicalReadBytes.max).toBeLessThanOrEqual(4 * 1024 * 1024);
      expect(report.page.ms.p95).toBeLessThanOrEqual(300);
      expect(report.part.responseBytes.max).toBeLessThanOrEqual(128 * 1024);
      expect(report.window.heapGrowth.max).toBeLessThanOrEqual(32 * 1024 * 1024);
      expect(report.planning.ms.p95).toBeLessThanOrEqual(50);
      expect(report.repair.heapGrowth).toBeLessThanOrEqual(64 * 1024 * 1024);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }, 20 * 60_000);
});
