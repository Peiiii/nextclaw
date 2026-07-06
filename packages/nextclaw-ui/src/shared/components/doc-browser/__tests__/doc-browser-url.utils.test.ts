import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function importDocsUrlUtils(language: 'en' | 'zh' = 'en') {
  const i18n = await import('@/shared/lib/i18n');
  i18n.setLanguage(language);
  return await import('@/shared/components/doc-browser/utils/doc-browser-url.utils');
}

function stubTimeZone(timeZone: string) {
  vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
    resolvedOptions: () => ({ timeZone }),
  } as Intl.DateTimeFormat);
}

describe('doc browser docs URL utilities', () => {
  beforeEach(() => {
    vi.resetModules();
    stubTimeZone('America/Los_Angeles');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses the official docs origin for English users outside mainland by default', async () => {
    const { getDefaultDocsUrl } = await importDocsUrlUtils('en');

    expect(getDefaultDocsUrl()).toBe('https://docs.nextclaw.io/en/guide/getting-started');
  });

  it('uses the mainland mirror for users in the mainland timezone', async () => {
    stubTimeZone('Asia/Shanghai');

    const { getDefaultDocsUrl } = await importDocsUrlUtils('en');

    expect(getDefaultDocsUrl()).toBe('https://docs.nextclaw.net/en/guide/getting-started');
  });

  it('uses the mainland mirror for Chinese users by default', async () => {
    const { getDefaultDocsUrl } = await importDocsUrlUtils('zh');

    expect(getDefaultDocsUrl()).toBe('https://docs.nextclaw.net/zh/guide/getting-started');
  });

  it('lets an explicit docs base override the automatic origin', async () => {
    vi.stubEnv('VITE_NEXTCLAW_DOCS_BASE_URL', 'https://docs.example.com/');

    const { getDocsUrl } = await importDocsUrlUtils('zh');

    expect(getDocsUrl('/guide/model-selection')).toBe('https://docs.example.com/zh/guide/model-selection');
  });

  it('does not rewrite non-docs absolute URLs', async () => {
    const { getDocsUrl } = await importDocsUrlUtils('zh');

    expect(getDocsUrl('https://example.com/help')).toBe('https://example.com/help');
  });

  it('rewrites official docs URLs to the selected docs origin', async () => {
    const { getDocsUrl } = await importDocsUrlUtils('zh');

    expect(getDocsUrl('https://docs.nextclaw.io/en/guide/commands?tab=cli#start')).toBe(
      'https://docs.nextclaw.net/en/guide/commands?tab=cli#start',
    );
  });

  it('recognizes the mainland mirror as a docs URL', async () => {
    const { isDocsUrl } = await importDocsUrlUtils('en');

    expect(isDocsUrl('https://docs.nextclaw.net/zh/guide/getting-started')).toBe(true);
  });
});
