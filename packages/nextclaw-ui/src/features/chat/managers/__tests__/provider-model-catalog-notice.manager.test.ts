import { beforeEach, describe, expect, it } from 'vitest';
import {
  LARGE_PROVIDER_MODEL_CATALOG_THRESHOLD,
  ProviderModelCatalogNoticeManager,
} from '@/features/chat/managers/provider-model-catalog-notice.manager';

function buildOptions(providerId: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    providerId,
    value: `${providerId}/model-${index + 1}`,
  }));
}

describe('ProviderModelCatalogNoticeManager', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('treats a first large catalog as a browseable baseline and only surfaces later additions', () => {
    const manager = new ProviderModelCatalogNoticeManager();
    const initial = buildOptions('openrouter', LARGE_PROVIDER_MODEL_CATALOG_THRESHOLD + 1);

    expect(manager.filterUnseen(initial)).toEqual([]);
    expect(manager.initializeLargeCatalogs(initial)).toBe(true);
    expect(manager.filterUnseen([...initial, {
      providerId: 'openrouter',
      value: 'openrouter/new-after-baseline',
    }])).toEqual([{
      providerId: 'openrouter',
      value: 'openrouter/new-after-baseline',
    }]);
  });

  it('keeps small-catalog additions visible until the user marks the batch as seen', () => {
    const manager = new ProviderModelCatalogNoticeManager();
    const initial = buildOptions('opencode', 2);

    expect(manager.filterUnseen(initial)).toEqual(initial);
    expect(manager.acknowledge(initial)).toBe(true);
    expect(manager.filterUnseen(initial)).toEqual([]);
    expect(manager.filterUnseen([...initial, {
      providerId: 'opencode',
      value: 'opencode/new-after-seen',
    }])).toEqual([{
      providerId: 'opencode',
      value: 'opencode/new-after-seen',
    }]);
  });

  it('recovers from invalid persisted data without suppressing a small catalog', () => {
    window.localStorage.setItem('nextclaw.chat.provider-model-catalog-notices', '{broken-json');
    const manager = new ProviderModelCatalogNoticeManager();
    const options = buildOptions('opencode', 1);

    expect(manager.filterUnseen(options)).toEqual(options);
  });
});
