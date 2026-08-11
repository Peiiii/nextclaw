import type { ChatInputSurfaceItem } from '@nextclaw/agent-chat-ui';
import type { PanelAppEntryView } from '@/shared/lib/api';
import {
  resolveInputSurfaceMatchTier,
  scoreInputSurfaceSearchCandidate,
} from './input-surface-search.utils';

const PANEL_APP_SECTION_KEY = 'panel-apps';

export type PanelAppInputSurfaceItemTexts = {
  appIdLabel: string;
  fileLabel: string;
  noDescriptionLabel: string;
  subtitle: string;
};

function getPanelAppActivityTime(entry: PanelAppEntryView): number {
  return Date.parse(entry.lastOpenedAt ?? entry.updatedAt) || 0;
}

function resolvePanelAppInputSurfaceEntries(params: {
  entries: readonly PanelAppEntryView[];
  query: string;
}): PanelAppEntryView[] {
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
      const labelCompare = collator.compare(
        left.entry.title || left.entry.appId,
        right.entry.title || right.entry.appId,
      );
      return labelCompare || left.order - right.order;
    })
    .map(({ entry }) => entry);
}

function buildPanelAppInputSurfaceItemEntries(params: {
  entries: readonly PanelAppEntryView[];
  keyPrefix?: string;
  query: string;
  texts: PanelAppInputSurfaceItemTexts;
}): Array<{ entry: PanelAppEntryView; item: ChatInputSurfaceItem }> {
  const keyPrefix = params.keyPrefix ?? 'panel-app';
  return resolvePanelAppInputSurfaceEntries({
    entries: params.entries,
    query: params.query,
  }).map((entry) => ({
    entry,
    item: {
      key: `${keyPrefix}:${entry.appId}`,
      icon: 'panel-app',
      title: entry.title || entry.appId,
      subtitle: params.texts.subtitle,
      description: (entry.description ?? '').trim() || params.texts.noDescriptionLabel,
      detailLines: [
        `${params.texts.appIdLabel}: ${entry.appId}`,
        `${params.texts.fileLabel}: ${entry.fileName}`,
      ],
    },
  }));
}

export function buildPanelAppInputSurfaceItems(params: {
  entries: readonly PanelAppEntryView[];
  keyPrefix?: string;
  query: string;
  texts: PanelAppInputSurfaceItemTexts;
}): ChatInputSurfaceItem[] {
  return buildPanelAppInputSurfaceItemEntries(params).map(({ item }) => item);
}

export function buildPanelAppReferenceItems(params: {
  entries: readonly PanelAppEntryView[];
  query: string;
  sectionLabel: string;
  texts: PanelAppInputSurfaceItemTexts;
}): ChatInputSurfaceItem[] {
  return buildPanelAppInputSurfaceItemEntries(params).map(({ entry, item }) => ({
    ...item,
    sectionKey: PANEL_APP_SECTION_KEY,
    sectionLabel: params.sectionLabel,
    tokenKind: 'panel_app',
    tokenKey: entry.appId,
    value: entry.appId,
  }));
}
