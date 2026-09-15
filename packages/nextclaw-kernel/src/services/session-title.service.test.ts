import { describe, expect, it, vi } from 'vitest';
import type { AgentSessionRecord } from '@nextclaw/ncp-toolkit';
import { SessionTitleService } from './session-title.service.js';

function fixture(metadata: Record<string, unknown> = { label: '你好，帮我看看杭州天气', label_source: 'fallback' }) {
  const record: AgentSessionRecord = {
    sessionId: 'title-test', updatedAt: new Date().toISOString(), metadata,
    messages: [
      { id: 'user', sessionId: 'title-test', role: 'user', status: 'final', parts: [{ type: 'text', text: '你好，帮我看看杭州天气' }] },
    ],
  };
  const chat = vi.fn().mockResolvedValue({ content: '{"title":"杭州天气查询"}' });
  const applyGeneratedTitle = vi.fn().mockResolvedValue(true);
  const getSessionRecord = vi.fn().mockResolvedValue(record);
  const service = new SessionTitleService({ getSessionRecord, applyGeneratedTitle } as never, { chat } as never);
  return { service, record, chat, applyGeneratedTitle, getSessionRecord };
}

describe('SessionTitleService', () => {
  it.each([{}, { preferred_model: 'unavailable/default', model: 'unavailable/default' }])('uses the triggering input model instead of current preferences %j', async metadata => {
    const f = fixture({ label: '你好，帮我看看杭州天气', label_source: 'fallback', ...metadata });
    f.record.messages[0].metadata = { run_spec: { model: 'selected/available' } };
    await f.service.schedule('title-test', 'user');
    expect(f.chat).toHaveBeenCalledWith(expect.objectContaining({ model: 'selected/available' }));
  });

  it('summarizes actual content once with no tools and a bounded request', async () => {
    const f = fixture();
    await f.service.schedule('title-test');
    expect(f.chat).toHaveBeenCalledWith(expect.objectContaining({
      maxTokens: 160,
      requestId: 'user',
      sessionId: 'title-test',
      thinkingLevel: 'off',
    }));
    expect(f.chat.mock.calls[0][0].tools).toBeUndefined();
    expect(f.applyGeneratedTitle).toHaveBeenCalledWith('title-test', {
      label: f.record.metadata?.label, label_source: 'fallback', title_attempt_message_id: undefined,
    }, '杭州天气查询', 'user');
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

  it('generates a useful title for a greeting-only conversation', async () => {
    const f = fixture();
    f.record.messages[0].parts = [{ type: 'text', text: '你好' }];
    f.chat.mockResolvedValue({ content: '{"title":"日常问候"}' });
    await f.service.schedule('title-test');
    expect(f.applyGeneratedTitle).toHaveBeenLastCalledWith('title-test', expect.any(Object), '日常问候', 'user');
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

  it('does not mark an empty model result as a completed title attempt', async () => {
    const f = fixture();
    f.chat.mockResolvedValue({ content: '{"title":null}' });
    await f.service.schedule('title-test');
    expect(f.applyGeneratedTitle).not.toHaveBeenCalled();
  });

  it('drops a stale result and retries the newest queued user input', async () => {
    const f = fixture();
    let finishFirst!: (result: { content: string }) => void;
    f.chat.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
    const first = f.service.schedule('title-test', 'user');
    await vi.waitFor(() => expect(f.chat).toHaveBeenCalledOnce());
    f.record.messages.push({
      id: 'new-user', sessionId: 'title-test', role: 'user', status: 'final',
      parts: [{ type: 'text', text: '重点分析西湖周边天气' }],
    });
    await f.service.schedule('title-test', 'new-user');
    finishFirst({ content: '{"title":"过时标题"}' });
    await first;
    await vi.waitFor(() => expect(f.chat).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(f.applyGeneratedTitle).toHaveBeenCalledWith(
      'title-test', expect.any(Object), '杭州天气查询', 'new-user',
    ));
    expect(f.applyGeneratedTitle).not.toHaveBeenCalledWith(
      'title-test', expect.any(Object), '过时标题', 'user',
    );
  });
});
