import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import { createTempDir, createRecord, createFixture, cleanupSessionFixtures } from "@kernel/utils/__tests__/session-manager-fixture.utils.js";

afterEach(cleanupSessionFixtures);

describe("Session pin persistence", () => {
  it("persists pins across cold storage reads without losing concurrent settings", async () => {
    const fixture = await createFixture([createRecord({ sessionId: 'session-1', metadata: { label: 'Before' } })]);
    await Promise.all([
      fixture.manager.patchSessionSettings('session-1', { pinned: true }),
      fixture.manager.patchSessionSettings('session-1', { uiReadAt: '2026-10-02T00:00:00.000Z' }),
      fixture.manager.patchSessionSettings('session-1', { label: 'After' }),
    ]);
    expect((await fixture.manager.getSession('session-1'))?.metadata).toMatchObject({
      pinned: true, label: 'After', ui_last_read_at: '2026-10-02T00:00:00.000Z',
    });
    await fixture.manager.patchSessionSettings('session-1', { pinned: false });
    await fixture.manager.patchSessionSettings('session-1', { pinned: true, pinnedIfUnset: true });
    const restored = new NcpAgentSessionJournalStore(join(fixture.sessionsDir, '.ncp-agent-journal'));
    try {
      expect((await restored.getSessionSummary('session-1'))?.metadata).toMatchObject({ pinned: false, label: 'After' });
    } finally {
      restored.close();
    }
    await expect(fixture.manager.patchSessionSettings('session-1', { pinned: 'true' } as never))
      .rejects.toMatchObject({ code: 'PINNED_INVALID' });
    await fixture.manager.patchSessionSettings('session-1', { pinned: true });
    expect((await fixture.manager.getSession('session-1'))?.metadata?.pinned).toBe(true);
    fixture.manager.dispose();
  });

  it("keeps an older pinned session on the first page after cold reload", async () => {
    const tempDir = createTempDir();
    const store = new NcpAgentSessionJournalStore(tempDir);
    for (const index of [1, 2, 3, 4, 5]) {
      await store.importSessionSnapshot({
        ...createRecord({ sessionId: `session-${index}`, messages: [] }),
        sessionId: `session-${index}`,
        createdAt: `2026-05-14T00:00:0${index}.000Z`,
        metadata: { label: `Page ${index}`, pinned: index === 1 },
      });
    }
    store.close();
    const restored = new NcpAgentSessionJournalStore(tempDir);
    try {
      const first = await restored.listSessionSummaryPage({ page: 1, pageSize: 2 });
      expect(first).toMatchObject({ total: 5, sessions: [{ sessionId: "session-1" }, { sessionId: "session-5" }] });
      const second = await restored.listSessionSummaryPage({ page: 2, pageSize: 2 });
      const third = await restored.listSessionSummaryPage({ page: 3, pageSize: 2 });
      expect([...first.sessions, ...second.sessions, ...third.sessions].map((session) => session.sessionId))
        .toEqual(["session-1", "session-5", "session-4", "session-3", "session-2"]);
      await restored.updateSessionMetadata({ sessionId: "session-1", metadata: { pinned: false } });
      expect((await restored.listSessionSummaryPage({ page: 3, pageSize: 2 })).sessions[0]?.sessionId).toBe("session-1");
      expect(await restored.listSessionSummaryPage({ page: 1, pageSize: 2, query: "Page 1" }))
        .toMatchObject({ total: 1, sessions: [{ sessionId: "session-1", metadata: { pinned: false } }] });
    } finally {
      restored.close();
    }
  });

});
