import { describe, expect, it, vi } from 'vitest';
import type { AgentSessionRecord } from '@nextclaw/ncp-toolkit';
import { SessionTitleService } from './session-title.service.js';

function fixture(metadata: Record<string, unknown> = { label: '你好，帮我看看杭州天气', label_source: 'fallback' }) {
  const record: AgentSessionRecord = {
    sessionId: 'title-test', updatedAt: new Date().toISOString(), metadata,
    messages: [
      { id: 'user', sessionId: 'title-test', role: 'user', status: 'final', parts: [{ type: 'text', text: '你好，帮我看看杭州天气' }] },
      { id: 'assistant', sessionId: 'title-test', role: 'assistant', status: 'final', parts: [{ type: 'text', text: '杭州今天晴。' }] },
    ],
  };
  const chat = vi.fn().mockResolvedValue({ content: '{"title":"杭州天气查询"}' });
  const applyGeneratedTitle = vi.fn().mockResolvedValue(true);
  const getSessionRecord = vi.fn().mockResolvedValue(record);
  const service = new SessionTitleService({ getSessionRecord, applyGeneratedTitle } as never, { chat } as never);
  return { service, record, chat, applyGeneratedTitle, getSessionRecord };
}

describe('SessionTitleService', () => {
  it('summarizes actual content once with no tools and a bounded request', async () => {
    const f = fixture();
    await f.service.schedule('title-test');
    expect(f.chat).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 160, thinkingLevel: 'off' }));
    expect(f.chat.mock.calls[0][0].tools).toBeUndefined();
    expect(f.applyGeneratedTitle).toHaveBeenCalledWith('title-test', {
      label: f.record.metadata?.label, label_source: 'fallback', title_attempt_message_id: undefined,
    }, '杭州天气查询', 'assistant');
  });

  it.each([{ label: 'My name', label_source: 'manual' }, { label: '杭州天气', label_source: 'generated' }, { label: 'Custom legacy name' }])('preserves owned title %j', async metadata => {
    const f = fixture(metadata);
    await f.service.schedule('title-test');
    expect(f.chat).not.toHaveBeenCalled();
  });

  it('allows an exact legacy first-message title to improve', async () => {
    const f = fixture({ label: '你好，帮我看看杭州天气' });
    await f.service.schedule('title-test');
    expect(f.applyGeneratedTitle).toHaveBeenCalled();
  });

  it('waits for a topic instead of installing a greeting as the title', async () => {
    const f = fixture();
    f.chat.mockResolvedValue({ content: '{"title":null}' });
    await f.service.schedule('title-test');
    expect(f.applyGeneratedTitle).toHaveBeenLastCalledWith('title-test', expect.any(Object), null, 'assistant');
  });

  it('ignores malformed results and aborts pending work on disposal', async () => {
    const f = fixture();
    f.chat.mockResolvedValue({ content: '{"title":"first\\nsecond"}' });
    await f.service.schedule('title-test');
    expect(f.applyGeneratedTitle).not.toHaveBeenCalled();
    let finish!: (result: { content: string }) => void;
    f.chat.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const pending = f.service.schedule('title-test');
    await vi.waitFor(() => expect(f.chat).toHaveBeenCalledTimes(2));
    f.service.dispose();
    finish({ content: '{"title":"Do not install"}' });
    await pending;
    expect(f.applyGeneratedTitle).not.toHaveBeenCalled();
  });
});
