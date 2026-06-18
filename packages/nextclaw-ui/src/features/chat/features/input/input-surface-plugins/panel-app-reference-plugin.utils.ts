import {
  createInputSurfaceReferenceTokenPlugin,
  type ChatInputSurfaceItem,
  type ChatInputSurfaceMenuTexts,
  type ChatInputSurfacePlugin,
  type ChatInputSurfaceTriggerSpec,
} from '@nextclaw/agent-chat-ui';
import type { ChatInputProductPluginData } from './chat-input-product-plugin-adapters.types';
import type { PanelAppEntryView } from '@/shared/lib/api';
import {
  scoreInputSurfaceSearchCandidate,
  resolveInputSurfaceMatchTier,
} from './input-surface-search.utils';

export const PANEL_APP_REFERENCE_TRIGGER_SPEC: ChatInputSurfaceTriggerSpec = {
  key: 'panel-app-reference',
  marker: '@',
};

function getPanelAppActivityTime(entry: PanelAppEntryView): number {
  return Date.parse(entry.lastOpenedAt ?? entry.updatedAt) || 0;
}

function buildPanelAppReferenceItems(params: {
  entries: readonly PanelAppEntryView[];
  query: string;
  texts: {
    appIdLabel: string;
    fileLabel: string;
    noDescriptionLabel: string;
    subtitle: string;
  };
}): ChatInputSurfaceItem[] {
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  return params.entries
    .map((entry, order) => ({
      entry,
      order,
      score: scoreInputSurfaceSearchCandidate(
        {
          id: entry.appId,
          label: entry.title || entry.appId,
          description: entry.description,
          aliases: [entry.id, entry.fileName],
        },
        params.query,
      ),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      const leftTier = resolveInputSurfaceMatchTier(left.score);
      const rightTier = resolveInputSurfaceMatchTier(right.score);
      if (rightTier !== leftTier) {
        return rightTier - leftTier;
      }
      if (left.entry.favorite !== right.entry.favorite) {
        return left.entry.favorite ? -1 : 1;
      }
      const rightActivity = getPanelAppActivityTime(right.entry);
      const leftActivity = getPanelAppActivityTime(left.entry);
      if (rightActivity !== leftActivity) {
        return rightActivity - leftActivity;
      }
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      const labelCompare = collator.compare(left.entry.title || left.entry.appId, right.entry.title || right.entry.appId);
      return labelCompare || left.order - right.order;
    })
    .map(({ entry }) => ({
      key: `panel-app:${entry.appId}`,
      title: entry.title || entry.appId,
      subtitle: params.texts.subtitle,
      description: (entry.description ?? '').trim() || params.texts.noDescriptionLabel,
      detailLines: [
        `${params.texts.appIdLabel}: ${entry.appId}`,
        `${params.texts.fileLabel}: ${entry.fileName}`,
      ],
      tokenKind: 'panel_app',
      tokenKey: entry.appId,
      value: entry.appId,
    }));
}

export function createPanelAppReferenceInputSurfacePlugin(params: {
  itemTexts: {
    appIdLabel: string;
    fileLabel: string;
    noDescriptionLabel: string;
    subtitle: string;
  };
  menuTexts: ChatInputSurfaceMenuTexts;
}): ChatInputSurfacePlugin<ChatInputProductPluginData> {
  return createInputSurfaceReferenceTokenPlugin({
    key: 'panel-app-reference',
    trigger: PANEL_APP_REFERENCE_TRIGGER_SPEC,
    tokenKind: 'panel_app',
    texts: params.menuTexts,
    getIsLoading: ({ data }) => data.isPanelAppsLoading,
    getRecords: ({ data }) => data.panelApps,
    getItems: ({ records, query }) =>
      buildPanelAppReferenceItems({
        entries: records,
        query,
        texts: params.itemTexts,
      }),
  });
}
