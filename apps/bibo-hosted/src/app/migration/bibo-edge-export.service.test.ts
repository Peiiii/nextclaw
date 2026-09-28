import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NcpAgentSessionJournalStore } from "@nextclaw/kernel";
import { NcpEventType } from "@nextclaw/ncp";
import { BiboSpaceService } from "@/features/bibo-domain";
import { exportBiboEdgeState, importBiboEdgeState } from "./bibo-edge-export.service";

test("legacy exporter reads canonical NCP history, personal files, identity and deliveries without changing them", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "bibo-edge-export-"));
  t.after(async () => await rm(home, { recursive: true, force: true }));
  await mkdir(join(home, "workspace", "memory"), { recursive: true });
  await mkdir(join(home, "inbox"), { recursive: true });
  await writeFile(join(home, "workspace", "IDENTITY.md"), "# Personal Bibo\n");
  await writeFile(join(home, "workspace", "memory", "MEMORY.md"), "Remember the user preference.");
  await mkdir(join(home, "workspace", "notes"));
  await writeFile(join(home, "workspace", "notes", "draft.txt"), "Unindexed but still user-owned text.");
  await writeFile(join(home, "inbox", "deliveries.json"), '{"deliveries":[]}');
  const space = new BiboSpaceService(home);
  const file = await space.execute("file.create", { path: "note.md", kind: "note", content: "original body" }) as { id: string };
  const journal = new NcpAgentSessionJournalStore(join(home, "sessions", ".ncp-agent-journal"));
  await journal.initialize();
  const now = new Date().toISOString();
  await journal.appendSessionEvent({ sessionId: "old-session", event: {
    type: NcpEventType.MessageSent, occurredAt: now, payload: { sessionId: "old-session", message: {
      id: "old-user", sessionId: "old-session", role: "user", status: "final", timestamp: now,
      parts: [{ type: "text", text: "previous question" }],
    } },
  } });
  journal.close();
  const exported = await exportBiboEdgeState(home, space, ["old-session"]);
  assert.equal(exported.sessions[0]?.record?.messages[0]?.parts[0]?.type, "text");
  assert.equal(exported.files.find((item) => item.id === file.id)?.content, "original body");
  assert.equal(exported.workspaceTexts["IDENTITY.md"], "# Personal Bibo\n");
  assert.equal(exported.workspaceTexts["memory/MEMORY.md"], "Remember the user preference.");
  assert.equal(exported.workspaceTexts["notes/draft.txt"], "Unindexed but still user-owned text.");
  assert.equal(exported.workspaceTexts["note.md"], undefined, "indexed files have a single export owner");
  assert.equal(exported.deliveries, '{"deliveries":[]}');
});

test("legacy export refuses binary or linked workspace entries rather than silently losing them", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "bibo-edge-unmigratable-"));
  t.after(async () => await rm(home, { recursive: true, force: true }));
  await mkdir(join(home, "workspace"));
  const space = new BiboSpaceService(home);
  await writeFile(join(home, "workspace", "image.bin"), Buffer.from([0, 1, 2]));
  await assert.rejects(exportBiboEdgeState(home, space, []), /cannot be migrated as text/);
  await rm(join(home, "workspace", "image.bin"));
  await symlink(home, join(home, "workspace", "linked"));
  await assert.rejects(exportBiboEdgeState(home, space, []), /Unsupported Bibo workspace entry/);
});

test("reverse import rebuilds Node journals and files from newer edge facts", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "bibo-edge-rollback-"));
  t.after(async () => await rm(home, { recursive: true, force: true }));
  await mkdir(join(home, "workspace"), { recursive: true });
  const space = new BiboSpaceService(home);
  const oldFile = await space.execute("file.create", { path: "old.md", kind: "note", content: "stale" }) as { id: string };
  const now = new Date().toISOString();
  const source: Parameters<typeof importBiboEdgeState>[2] = {
    schema: 1, sessions: [{ sessionId: "old-session", record: { sessionId: "old-session", createdAt: now, updatedAt: now,
      metadata: { migrated: true }, messages: [{ id: "user-1", sessionId: "old-session", role: "user", status: "final", timestamp: now,
        parts: [{ type: "text", text: "newer edge turn" }] }] } }],
    spaceState: { schema: 1, tasks: [], projects: [], events: [], inbox: [], deliveryStatuses: {}, replays: {},
      files: [{ id: oldFile.id, path: "new.md", kind: "note", createdAt: now, updatedAt: now, version: 2 }] },
    files: [{ id: oldFile.id, content: "newer edge body" }], workspaceTexts: { "IDENTITY.md": "# My Bibo" }, deliveries: null,
  };
  await importBiboEdgeState(home, space, source);
  const result = await exportBiboEdgeState(home, space, ["old-session"]);
  assert.equal(result.sessions[0]?.record?.messages[0]?.parts[0]?.type, "text");
  assert.equal(result.sessions[0]?.record?.messages[0]?.parts[0]?.type === "text" ? result.sessions[0].record.messages[0].parts[0].text : null, "newer edge turn");
  assert.deepEqual(result.files, source.files);
  assert.equal(result.workspaceTexts["IDENTITY.md"], "# My Bibo");
  assert.equal((await space.exportState()).files[0]?.path, "new.md");
});
