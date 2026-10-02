import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { ConfigSchema, saveConfig } from '@nextclaw/core';
import { EventBus } from '@nextclaw/shared';
import { NcpAgentSessionJournalStore, SessionManager } from '@nextclaw/kernel';
import { createUiRouter } from '@nextclaw-server/app/router.js';
import { createRouterTestKernel } from '@nextclaw-server/app/tests/router-test-kernel.js';

it('filters real persisted sessions before HTTP pagination, including peer and search conditions', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nextclaw-scheduled-http-'));
  const configPath = join(dir, 'config.json');
  saveConfig(ConfigSchema.parse({}), configPath);
  const eventBus = new EventBus();
  const store = new NcpAgentSessionJournalStore(dir);
  const manager = new SessionManager({ journalStore: store, eventBus,
    agentManager: { resolveAgentProfile: () => ({ workspace: dir }) } as never,
    agentContextWindowManager: { forgetSession: () => undefined, previewSession: async () => null },
    projectManager: { normalizeSessionProjectContext: async () => null },
    resolveProjectContext: () => ({ projectRoot: null, effectiveWorkspace: dir }),
    sessionSearch: { handleSessionUpdated: () => undefined },
  });
  try {
    for (let i = 0; i < 5; i++) await store.importSessionSnapshot({
      sessionId: `session-${i}`, messages: [], createdAt: `2026-10-01T00:00:0${i}Z`, updatedAt: `2026-10-01T00:00:0${i}Z`,
      metadata: { label: 'Daily report', agent_peer_id: 'peer-1', ...(i < 3 ? { session_origin: 'cron' } : {}), ...(i === 0 ? { pinned: true } : {}) },
    });
    const app = createUiRouter({ configPath, appEventBus: eventBus, kernel: createRouterTestKernel({ sessionManager: manager }) });
    const path = 'http://localhost/api/ncp/sessions?scheduledOnly=true&peerId=peer-1&query=Daily&pageSize=2';
    const first = await app.request(path);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ data: { total: 3, page: 1, hasMore: true,
      sessions: [{ sessionId: 'session-0' }, { sessionId: 'session-2' }],
    } });
    expect(await (await app.request(`${path}&page=2`)).json()).toMatchObject({ data: {
      total: 3, page: 2, hasMore: false, sessions: [{ sessionId: 'session-1' }],
    } });
    expect(await (await app.request(`${path}&page=3`)).json()).toMatchObject({ data: { total: 3, sessions: [], hasMore: false } });
    expect(await (await app.request('http://localhost/api/ncp/sessions?scheduledOnly=false')).json()).toMatchObject({ data: { total: 5 } });
    expect((await app.request('http://localhost/api/ncp/sessions?scheduledOnly=maybe')).status).toBe(400);
  } finally {
    await manager.close(); store.close(); rmSync(dir, { recursive: true, force: true });
  }
});
