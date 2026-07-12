import { useEffect } from 'react';
import { fetchMarketplaceSkillContent } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';
import {
  setMarketplaceDetailDocEntry,
  useMarketplaceDetailDocStore,
} from '@/features/marketplace/stores/marketplace-detail-doc.store';

function parseMarketplaceDetailScopeKey(
  detailId: string,
): { scope: string; key: string } | null {
  const separator = detailId.indexOf(':');
  if (separator <= 0 || separator >= detailId.length - 1) {
    return null;
  }
  return {
    scope: detailId.slice(0, separator),
    key: detailId.slice(separator + 1),
  };
}

function isRehydratableSkillScope(scope: string): boolean {
  return scope === 'skill' || scope === 'skill-preview';
}

export function useMarketplaceDetailDocEntry(detailId: string | null) {
  const entry = useMarketplaceDetailDocStore((state) =>
    detailId ? state.entries[detailId] : undefined,
  );

  useEffect(() => {
    if (!detailId || useMarketplaceDetailDocStore.getState().entries[detailId]) {
      return;
    }
    const parsed = parseMarketplaceDetailScopeKey(detailId);
    if (!parsed || !isRehydratableSkillScope(parsed.scope)) {
      return;
    }

    let cancelled = false;
    const title = parsed.key;
    const typeLabel = t('marketplaceTypeSkill');

    void fetchMarketplaceSkillContent(parsed.key)
      .then((content) => {
        if (cancelled) {
          return;
        }
        setMarketplaceDetailDocEntry({
          id: detailId,
          title,
          typeLabel,
          spec: parsed.key,
          status: 'ready',
          summary: t('marketplaceInstalledLocalSummary'),
          metadataRaw: content.metadataRaw,
          contentRaw: content.bodyRaw || content.raw,
          sourceUrl: content.sourceUrl,
          sourceLabel: content.source ? `Source (${content.source})` : undefined,
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setMarketplaceDetailDocEntry({
          id: detailId,
          title,
          typeLabel,
          spec: parsed.key,
          status: 'error',
          summary: t('marketplaceInstalledLocalSummary'),
          metadataRaw: JSON.stringify({ skill: parsed.key }, null, 2),
          contentRaw: t('marketplaceDetailUnavailableDescription'),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [detailId]);

  return entry;
}
