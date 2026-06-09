import {
  createAppsPanelUrl,
  getAppsPanelTabFromUrl,
} from '@/features/panel-apps/utils/panel-app-doc-browser.utils';

describe('panel app doc browser URL helpers', () => {
  it('uses the root apps URL for the default panel apps tab', () => {
    expect(createAppsPanelUrl('panel-apps')).toBe('nextclaw://apps');
    expect(getAppsPanelTabFromUrl('nextclaw://apps')).toBe('panel-apps');
  });

  it('round-trips the service apps tab through the hidden apps URL', () => {
    const url = createAppsPanelUrl('service-apps');

    expect(url).toBe('nextclaw://apps?tab=service-apps');
    expect(getAppsPanelTabFromUrl(url)).toBe('service-apps');
  });

  it('falls back to panel apps for unknown URL state', () => {
    expect(getAppsPanelTabFromUrl('nextclaw://apps?tab=unknown')).toBe('panel-apps');
    expect(getAppsPanelTabFromUrl('not a url')).toBe('panel-apps');
  });
});
