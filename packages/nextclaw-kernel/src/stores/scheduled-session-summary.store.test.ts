import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { NcpAgentSessionSummaryIndexStore } from './ncp-agent-session-summary-index.store.js';

let store: NcpAgentSessionSummaryIndexStore | undefined;
let directory: string | undefined;
afterEach(async () => {
  store?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

it('classifies stored origins before paging, composes filters and survives a cold reopen', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nextclaw-scheduled-catalog-'));
  store = new NcpAgentSessionSummaryIndexStore(directory, async () => null);
  const fixtures = [
    { sessionId: 'origin', metadata: { session_origin: 'cron', label: 'Daily report', pinned: true } },
    { sessionId: 'job', metadata: { cron_job_id: ' job-2 ', label: 'Daily report' } },
    { sessionId: 'cron:legacy', metadata: { label: 'Legacy report' } },
    { sessionId: 'manual', metadata: { label: 'cron Daily report' } },
    { sessionId: 'invalid', metadata: { cron_job_id: false, label: 'Daily report' } },
    { sessionId: 'empty', metadata: { cron_job_id: '  ', label: 'Daily report' } },
  ];
  for (const [index, fixture] of fixtures.entries()) {
    await store.upsert({ ...fixture, peerId: index < 2 ? 'peer-1' : 'peer-2',
      messageCount: 0, status: 'idle', createdAt: `2026-10-01T00:00:0${index}Z`, updatedAt: `2026-10-01T00:00:0${index}Z`,
    });
  }
  store.close();
  store = new NcpAgentSessionSummaryIndexStore(directory, async () => null);
  const filter = { scheduledOnly: true };
  expect(await store.count(filter)).toBe(3);
  expect((await store.listPage({ ...filter, offset: 0, limit: 2 })).map(s => s.sessionId)).toEqual(['origin', 'cron:legacy']);
  expect((await store.listPage({ ...filter, offset: 2, limit: 2 })).map(s => s.sessionId)).toEqual(['job']);
  expect(await store.count({ ...filter, peerId: 'peer-1', query: 'DAILY' })).toBe(2);
  expect((await store.listPage({ ...filter, peerId: 'peer-1', query: 'daily', offset: 1, limit: 1 })).map(s => s.sessionId)).toEqual(['job']);
  expect(await store.count({ scheduledOnly: false })).toBe(6);
  expect(await store.count({ ...filter, query: 'no match' })).toBe(0);
});
