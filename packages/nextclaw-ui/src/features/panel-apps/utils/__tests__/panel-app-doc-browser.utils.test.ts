import {
  createAppsPanelUrl,
  getAppsPanelTabFromUrl,
} from '@/features/panel-apps/utils/panel-app-doc-browser.utils';

describe('panel app doc browser URL helpers', () => {
  it('uses the root apps URL for the package library', () => {
    expect(createAppsPanelUrl('apps')).toBe('nextclaw://apps');
    expect(getAppsPanelTabFromUrl('nextclaw://apps')).toBe('apps');
  });

  it('round-trips the developer panel apps tab', () => {
    const url = createAppsPanelUrl('panel-apps');

    expect(url).toBe('nextclaw://apps?tab=panel-apps');
    expect(getAppsPanelTabFromUrl(url)).toBe('panel-apps');
  });

  it('round-trips the service apps tab through the hidden apps URL', () => {
    const url = createAppsPanelUrl('service-apps');

    expect(url).toBe('nextclaw://apps?tab=service-apps');
    expect(getAppsPanelTabFromUrl(url)).toBe('service-apps');
  });

  it('falls back to the package library for unknown URL state', () => {
    expect(getAppsPanelTabFromUrl('nextclaw://apps?tab=unknown')).toBe('apps');
    expect(getAppsPanelTabFromUrl('not a url')).toBe('apps');
  });
});
