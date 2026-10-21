import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { scanBoundedSessionJournal } from "./session-journal-stream.utils.js";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture(raw: string) {
  const directory = await mkdtemp(join(tmpdir(), "bounded-journal-"));
  directories.push(directory);
  const path = join(directory, "session.jsonl");
  await writeFile(path, raw);
  return { path, endOffset: (await stat(path)).size };
}

describe("bounded journal token reader", () => {
  it("keeps resumable byte boundaries correct across blank and CRLF lines", async () => {
    const raw = ' \r\n{"seq":1}\r\n\n\t\n{"seq":2}\n';
    const file = await fixture(raw);
    const boundaries: number[] = [];
    await scanBoundedSessionJournal({ ...file, onEntry: async (_, boundary) => { boundaries.push(boundary); } });
    expect(boundaries).toEqual([raw.indexOf('}\r\n') + 3, raw.length]);
    const resumed: unknown[] = [];
    await scanBoundedSessionJournal({ ...file, startOffset: boundaries[0], onEntry: async entry => { resumed.push(entry.seq); } });
    expect(resumed).toEqual([2]);
  });
  it("keeps event identities and exact entry boundaries across UTF-8 read chunks", async () => {
    const entries = Array.from({ length: 200 }, (_, seq) => ({ seq, event: { type: "message.sent", payload: {
      message: { id: `message-${seq}`, parts: [{ type: "text", text: `汉字 " \\ ${"a".repeat(seq * 2)}` }] },
    } } }));
    const lines = entries.map(value => `${JSON.stringify(value)}\n`);
    const file = await fixture(lines.join(""));
    const observed: unknown[] = [];
    const boundaries: number[] = [];
    await scanBoundedSessionJournal({ ...file, onEntry: async (entry, boundary, _, truncated) => {
      expect(truncated).toBe(false); observed.push(entry); boundaries.push(boundary);
    } });
    expect(observed).toEqual(entries);
    let offset = 0;
    expect(boundaries).toEqual(lines.map(line => offset += Buffer.byteLength(line)));
  });

  it("streams a giant single string while keeping a bounded event skeleton", async () => {
    const text = "汉字𝌆\\\"".repeat(1_000_000);
    const file = await fixture(`${JSON.stringify({ event: { payload: { message: { id: "giant", parts: [{ type: "text", text }] } } } })}\n`);
    let bytes = 0;
    let count = 0;
    await scanBoundedSessionJournal({ ...file, onToken: (token, path) => {
      if (token.name === "stringChunk" && path.join(".") === "event.payload.message.parts.0.text") bytes += Buffer.byteLength(token.value ?? "");
    }, onEntry: async (entry, boundary, _, truncated) => {
      count += 1; expect(truncated).toBe(true); expect(JSON.stringify(entry).length).toBeLessThan(4_096); expect(boundary).toBe(file.endOffset);
    } });
    // UTF-16 chunks may split surrogate pairs; exact preservation is checked after concatenation by the projection tests.
    expect(bytes).toBeGreaterThanOrEqual(Buffer.byteLength(text));
    expect(count).toBe(1);
  }, 30_000);

  it("does not let __proto__ mutate the event skeleton prototype", async () => {
    const file = await fixture('{"__proto__":{"polluted":true},"event":{"type":"safe"}}\n');
    await scanBoundedSessionJournal({ ...file, onEntry: async entry => {
      expect(Object.getPrototypeOf(entry)).toBeNull();
      expect(Object.prototype.hasOwnProperty.call(entry, "__proto__")).toBe(true);
    } });
  });

  it("cancels between completed entries and exposes a resumable boundary", async () => {
    const lines = Array.from({ length: 100 }, (_, seq) => `${JSON.stringify({ seq })}\n`);
    const file = await fixture(lines.join(""));
    const controller = new AbortController();
    let offset = 0;
    await expect(scanBoundedSessionJournal({ ...file, signal: controller.signal, onEntry: async (_, boundary, index) => {
      offset = boundary; if (index === 9) controller.abort();
    } })).rejects.toMatchObject({ name: "AbortError" });
    const recovered: number[] = [];
    await scanBoundedSessionJournal({ ...file, startOffset: offset, onEntry: async entry => { recovered.push(Number(entry.seq)); } });
    expect(recovered).toEqual(Array.from({ length: 90 }, (_, index) => index + 10));
  });
});
