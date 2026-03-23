import { beforeEach, describe, expect, it } from 'vitest';
import type { RemoteAccessView } from '@/api/remote.types';
import { setLanguage } from '@/lib/i18n';
import { buildRemoteAccessFeedbackView, requiresRemoteReauthorization } from '@/remote/remote-access-feedback.service';

function createRemoteAccessView(overrides: Partial<RemoteAccessView> = {}): RemoteAccessView {
  return {
    account: {
      loggedIn: true,
      email: 'user@example.com',
      apiBase: 'https://ai-gateway-api.nextclaw.io/v1',
      platformBase: 'https://ai-gateway-api.nextclaw.io'
    },
    settings: {
      enabled: true,
      deviceName: 'MacBook Pro',
      platformApiBase: 'https://ai-gateway-api.nextclaw.io/v1'
    },
    service: {
      running: true,
      currentProcess: false
    },
    localOrigin: 'http://127.0.0.1:55667',
    configuredEnabled: true,
    platformBase: 'https://ai-gateway-api.nextclaw.io',
    runtime: {
      enabled: true,
      mode: 'service',
      state: 'error',
      deviceName: 'MacBook Pro',
      lastError: 'Remote relay closed unexpectedly.',
      updatedAt: '2026-03-23T00:00:00.000Z'
    },
    ...overrides
  };
}

describe('remote-access-feedback.service', () => {
  beforeEach(() => {
    setLanguage('zh');
  });

  it('turns token errors into a reauthorization experience', () => {
    const status = createRemoteAccessView({
      runtime: {
        enabled: true,
        mode: 'service',
        state: 'error',
        lastError: 'Invalid or expired token.',
        updatedAt: '2026-03-23T00:00:00.000Z'
      }
    });

    expect(requiresRemoteReauthorization(status)).toBe(true);

    const feedback = buildRemoteAccessFeedbackView(status);

    expect(feedback.hero.title).toBe('登录已过期，请重新登录 NextClaw');
    expect(feedback.primaryAction?.kind).toBe('reauthorize');
    expect(feedback.primaryAction?.label).toBe('重新登录并恢复远程访问');
    expect(feedback.issueHint?.body).not.toContain('Invalid or expired token');
  });

  it('keeps generic reconnect guidance for non-auth runtime errors', () => {
    const status = createRemoteAccessView();

    expect(requiresRemoteReauthorization(status)).toBe(false);

    const feedback = buildRemoteAccessFeedbackView(status);

    expect(feedback.hero.title).toBe('远程访问暂时没有连上');
    expect(feedback.primaryAction?.kind).toBe('repair');
    expect(feedback.issueHint?.body).toBe('远程访问暂时不可用。你可以先重新连接；如果问题持续，再重新登录或稍后再试。');
  });
});
