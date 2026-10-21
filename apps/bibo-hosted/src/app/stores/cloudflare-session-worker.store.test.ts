import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { isBuiltin } from "node:module";
import { writeFile } from "node:fs/promises";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";

test("real SQLite Durable Object preserves bounded pages, exact source, isolation and failed commits", async () => {
  const built = await build({ stdin: { resolveDir: process.cwd(), sourcefile: "session-do.integration.ts", contents: `
    import { DurableObject } from "cloudflare:workers";
    import { CloudflareSessionStore } from "./src/app/stores/cloudflare-session.store.ts";
    export class SessionTestObject extends DurableObject {
      fail = false;
      constructor(ctx, env) { super(ctx, env); this.driver = {
        sql: ctx.storage.sql, get: ctx.storage.get.bind(ctx.storage), put: ctx.storage.put.bind(ctx.storage),
        list: ctx.storage.list.bind(ctx.storage), delete: ctx.storage.delete.bind(ctx.storage),
        transaction: operation => ctx.storage.transaction(async transaction => {
          const value = await operation(transaction); if (this.fail) { this.fail = false; throw new Error("injected transaction failure"); } return value;
        }),
      }; this.store = new CloudflareSessionStore(this.driver); }
      async fetch(request) {
        const value = await request.json(); const store = this.store;
        try {
          if (value.op === "import") { await store.importSessionSnapshot(value.record); return Response.json({ok:true}); }
          if (value.op === "append") { this.fail = Boolean(value.fail); await store.appendSessionEvent(value.input); return Response.json({ok:true}); }
          if (value.op === "part") return Response.json(await store.readSessionMessagePart(value.input));
          if (value.op === "source") return Response.json(await store.captureCompactionSource(value.id, value.ids));
          if (value.op === "window") return Response.json(await store.loadSessionRunSeed(value.id));
          if (value.op === "reopen") { this.store = new CloudflareSessionStore(this.driver); return Response.json({ok:true}); }
          if (value.op === "raw") {
            const id = value.id; const prefix = JSON.stringify({_type:"event",seq:1,event:{type:"session.snapshot.message",payload:{message:{id:"raw-message",sessionId:id,role:"assistant",status:"final",timestamp:"2026-10-19T00:00:00.000Z",parts:[{type:"text",text:"PLACEHOLDER"}]}}}}).split('PLACEHOLDER');
            let offset = 0, chunk = 0; const append = text => { const end = offset + new TextEncoder().encode(text).length; this.driver.sql.exec("INSERT INTO session_journal VALUES (?,?,?,?,?,?)", id, 1, chunk++, offset, end, text); offset = end; };
            append(prefix[0]); const body = "x".repeat(16384); for (let size = 0; size < value.bytes; size += body.length) append(body.slice(0, Math.min(body.length, value.bytes - size))); append(prefix[1] + "\\n");
            await this.driver.put("sessionHead:"+id, {sessionId:id,metadata:{},updatedAt:"2026-10-19T00:00:00.000Z",sequence:1,activeRun:null,storageVersion:2,journalBytes:offset,journalGeneration:crypto.randomUUID()});
            return Response.json({ok:true});
          }
          if (value.op === "prepare") { const state = await store.prepareSessionHistory(value.id, {retry:Boolean(value.retry)}); this.ctx.waitUntil(store.prepareSessionHistory(value.id, {wait:true}).catch(() => {})); return Response.json(state); }
          if (value.op === "control") return Response.json({ state: await store.prepareSessionHistory(value.id), cancelled: value.cancel ? store.cancelSessionHistoryPreparation(value.id) : false });
          return Response.json(await store.listSessionMessagePage({ sessionId:value.id, limit:40 }));
        } catch (error) { return Response.json({error:error.message}, {status:500}); }
      }
    }
    export default { fetch: (request, env) => env.TEST.get(env.TEST.idFromName("account")).fetch(request) };
  ` }, bundle: true, format: "esm", platform: "neutral", target: "es2022", mainFields: ["module", "main"], conditions: ["workerd"], external: ["node:*", "cloudflare:*"],
    banner: { js: 'import { createRequire } from "node:module"; const require = createRequire("/");' },
    plugins: [{ name: "worker-node-builtins", setup(builder) { builder.onResolve({ filter: /^[\w/]+$/ }, args => isBuiltin(args.path) ? { path: `node:${args.path}`, external: true } : undefined); } }], metafile: true, write: false });
  if (process.env.NEXTCLAW_WORKER_BUNDLE_DIAGNOSTICS) await writeFile(process.env.NEXTCLAW_WORKER_BUNDLE_DIAGNOSTICS, JSON.stringify(built.metafile));
  const worker = new Miniflare({ modules: true, script: built.outputFiles[0]!.text, compatibilityDate: "2026-09-24",
    compatibilityFlags: ["nodejs_compat"], durableObjects: { TEST: { className: "SessionTestObject", useSQLite: true } } });
  const call = async (value: unknown) => worker.dispatchFetch("https://test/", { method: "POST", body: JSON.stringify(value) });
  type TestResponse = { total: number; sourceCount: number; journalGeneration: string; content: string; nextCursor?: string; state: { status: string } };
  const read = async (value: unknown) => { const response = await call(value); assert.equal(response.status, 200, await response.clone().text()); return response.json() as Promise<TestResponse>; };
  try {
    const original = "汉字𝌆\\\"".repeat(100_000);
    const message = (sessionId: string, text: string): NcpMessage => ({ id: "same-id", sessionId, role: "assistant", status: "final", timestamp: "2026-10-19T00:00:00.000Z", parts: [{ type: "text", text }] });
    for (const id of ["one", "two"]) await read({ op: "import", record: { sessionId: id, updatedAt: "2026-10-19T00:00:00.000Z", metadata: {}, messages: [message(id, id === "one" ? original : "other session")] } });
    await read({ op: "reopen" });
    const page = await read({ op: "page", id: "one" }); assert.equal(page.total, 1); assert.ok(Buffer.byteLength(JSON.stringify(page)) < 32 * 1024); assert.ok(!JSON.stringify(page).includes(original));
    const source = await read({ op: "source", id: "one", ids: ["same-id"] }); assert.equal(source.sourceCount, 1); assert.ok(source.journalGeneration);
    const fragments: string[] = []; let cursor: string | undefined;
    do { const value = await read({ op: "part", input: { sessionId: "one", messageId: "same-id", part: 0, cursor } });
      assert.ok(Buffer.byteLength(value.content) <= 32 * 1024); fragments.push(value.content); cursor = value.nextCursor ?? undefined;
    } while (cursor);
    assert.deepEqual(JSON.parse(fragments.join("")), { type: "text", text: original });
    const other = await read({ op: "part", input: { sessionId: "two", messageId: "same-id", part: 0 } }); assert.deepEqual(JSON.parse(other.content), { type: "text", text: "other session" });
    const append = { sessionId: "one", event: { type: NcpEventType.MessageSent, payload: { sessionId: "one", message: { ...message("one", "must roll back"), id: "failed" } } } };
    assert.equal((await call({ op: "append", input: append, fail: true })).status, 500);
    assert.equal((await read({ op: "page", id: "one" })).total, 1);
    await read({ op: "append", input: { ...append, event: { ...append.event, payload: { ...append.event.payload, message: { ...append.event.payload.message, id: "success" } } } } });
    await read({ op: "reopen" }); assert.equal((await read({ op: "page", id: "one" })).total, 2);
    const window = await read({ op: "window", id: "one" }); assert.ok(Buffer.byteLength(JSON.stringify(window)) <= 8 * 1024 * 1024);
    await read({ op: "raw", id: "repair", bytes: 64 * 1024 * 1024 });
    await read({ op: "prepare", id: "repair" });
    const latencies: number[] = [];
    const deadline = performance.now() + 60_000;
    for (let index = 0; ; index++) {
      assert.ok(performance.now() < deadline, "repair must finish, rather than returning an endless preparation state");
      const started = performance.now(); const value = await read({ op: "control", id: "repair" }); latencies.push(performance.now() - started);
      assert.notEqual(value.state.status, "failed", JSON.stringify(value));
      if (index >= 29 && value.state.status === "ready") break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const p95 = latencies.sort((a,b)=>a-b)[Math.ceil(latencies.length * 0.95) - 1]!;
    console.log("WORKER_REPAIR_CONTROL", JSON.stringify({ samples: latencies.length, p95, max: Math.max(...latencies) }));
    assert.ok(p95 <= 500);
    const ready = await read({ op: "window", id: "repair" }); assert.ok(Buffer.byteLength(JSON.stringify(ready)) <= 8 * 1024 * 1024);
  } finally { await worker.dispose(); }
});
