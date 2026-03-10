import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { MarketplaceInstalledRecord } from '@/api/types';
import { t } from '@/lib/i18n';
import type { ChatInputBarSlashItem } from '@/components/chat/chat-input.types';

const SLASH_PANEL_MAX_WIDTH = 920;

type RankedSkill = {
  record: MarketplaceInstalledRecord;
  score: number;
  order: number;
};

type UseChatInputBarControllerParams = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => Promise<void> | void;
  onStop: () => Promise<void> | void;
  canStopGeneration: boolean;
  isSending: boolean;
  skillRecords: MarketplaceInstalledRecord[];
  isSkillsLoading: boolean;
  selectedSkills: string[];
  onSelectedSkillsChange: (next: string[]) => void;
};

type SlashPanelControllerParams = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => Promise<void> | void;
  onStop: () => Promise<void> | void;
  isSending: boolean;
  canStopGeneration: boolean;
  isSkillsLoading: boolean;
  selectedSkills: string[];
  onSelectedSkillsChange: (next: string[]) => void;
  skillRecords: MarketplaceInstalledRecord[];
};

function resolveSlashQuery(draft: string): string | null {
  const match = /^\/([^\s]*)$/.exec(draft);
  if (!match) {
    return null;
  }
  return (match[1] ?? '').trim().toLowerCase();
}

function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function isSubsequenceMatch(query: string, target: string): boolean {
  if (!query || !target) {
    return false;
  }
  let pointer = 0;
  for (const char of target) {
    if (char === query[pointer]) {
      pointer += 1;
      if (pointer >= query.length) {
        return true;
      }
    }
  }
  return false;
}

function scoreSkillRecord(record: MarketplaceInstalledRecord, query: string): number {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return 1;
  }

  const spec = normalizeSearchText(record.spec);
  const label = normalizeSearchText(record.label || record.spec);
  const description = normalizeSearchText(`${record.descriptionZh ?? ''} ${record.description ?? ''}`);
  const labelTokens = label.split(/[\s/_-]+/).filter(Boolean);

  if (spec === normalizedQuery) {
    return 1200;
  }
  if (label === normalizedQuery) {
    return 1150;
  }
  if (spec.startsWith(normalizedQuery)) {
    return 1000;
  }
  if (label.startsWith(normalizedQuery)) {
    return 950;
  }
  if (labelTokens.some((token) => token.startsWith(normalizedQuery))) {
    return 900;
  }
  if (spec.includes(normalizedQuery)) {
    return 800;
  }
  if (label.includes(normalizedQuery)) {
    return 760;
  }
  if (description.includes(normalizedQuery)) {
    return 500;
  }
  if (isSubsequenceMatch(normalizedQuery, label) || isSubsequenceMatch(normalizedQuery, spec)) {
    return 300;
  }
  return 0;
}

function buildSkillSlashItems(skillRecords: MarketplaceInstalledRecord[], normalizedSlashQuery: string): ChatInputBarSlashItem[] {
  const skillSortCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  const rankedRecords: RankedSkill[] = skillRecords
    .map((record, order) => ({
      record,
      score: scoreSkillRecord(record, normalizedSlashQuery),
      order
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      const leftLabel = (left.record.label || left.record.spec).trim();
      const rightLabel = (right.record.label || right.record.spec).trim();
      const labelCompare = skillSortCollator.compare(leftLabel, rightLabel);
      if (labelCompare !== 0) {
        return labelCompare;
      }
      return left.order - right.order;
    });

  return rankedRecords
    .map((entry) => entry.record)
    .map((record) => ({
      kind: 'skill',
      key: `skill:${record.spec}`,
      title: record.label || record.spec,
      subtitle: t('chatSlashTypeSkill'),
      description: (record.descriptionZh ?? record.description ?? '').trim() || t('chatSkillsPickerNoDescription'),
      detailLines: [`${t('chatSlashSkillSpec')}: ${record.spec}`],
      skillSpec: record.spec
    }));
}

function useSlashPanelController(params: SlashPanelControllerParams) {
  const [activeSlashIndex, setActiveSlashIndex] = useState(0);
  const [dismissedSlashPanel, setDismissedSlashPanel] = useState(false);
  const [slashPanelWidth, setSlashPanelWidth] = useState<number | null>(null);

  const slashAnchorRef = useRef<HTMLDivElement | null>(null);
  const slashListRef = useRef<HTMLDivElement | null>(null);

  const slashQuery = useMemo(() => resolveSlashQuery(params.draft), [params.draft]);
  const startsWithSlash = params.draft.startsWith('/');
  const normalizedSlashQuery = slashQuery ?? '';

  const skillSlashItems = useMemo(
    () => buildSkillSlashItems(params.skillRecords, normalizedSlashQuery),
    [normalizedSlashQuery, params.skillRecords]
  );
  const slashItems = useMemo(() => [...skillSlashItems], [skillSlashItems]);
  const isSlashPanelOpen = slashQuery !== null && !dismissedSlashPanel;
  const activeSlashItem = slashItems[activeSlashIndex] ?? null;
  const isSlashPanelLoading = params.isSkillsLoading;
  const resolvedSlashPanelWidth = slashPanelWidth ? Math.min(slashPanelWidth, SLASH_PANEL_MAX_WIDTH) : undefined;

  useEffect(() => {
    const anchor = slashAnchorRef.current;
    if (!anchor || typeof ResizeObserver === 'undefined') {
      return;
    }
    const update = () => {
      setSlashPanelWidth(anchor.getBoundingClientRect().width);
    };
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(anchor);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isSlashPanelOpen || slashItems.length === 0) {
      setActiveSlashIndex(0);
      return;
    }
    setActiveSlashIndex((current) => {
      if (current < 0) {
        return 0;
      }
      if (current >= slashItems.length) {
        return slashItems.length - 1;
      }
      return current;
    });
  }, [isSlashPanelOpen, slashItems.length]);

  useEffect(() => {
    if (!startsWithSlash && dismissedSlashPanel) {
      setDismissedSlashPanel(false);
    }
  }, [dismissedSlashPanel, startsWithSlash]);

  useEffect(() => {
    if (!isSlashPanelOpen || isSlashPanelLoading || slashItems.length === 0) {
      return;
    }
    const container = slashListRef.current;
    if (!container) {
      return;
    }
    const active = container.querySelector<HTMLElement>(`[data-slash-index="${activeSlashIndex}"]`);
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeSlashIndex, isSlashPanelLoading, isSlashPanelOpen, slashItems.length]);

  const handleSelectSlashItem = useCallback((item: ChatInputBarSlashItem) => {
    if (item.kind === 'skill' && item.skillSpec) {
      if (!params.selectedSkills.includes(item.skillSpec)) {
        params.onSelectedSkillsChange([...params.selectedSkills, item.skillSpec]);
      }
      params.onDraftChange('');
      setDismissedSlashPanel(false);
    }
  }, [params]);

  const onTextareaKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSlashPanelOpen && !event.nativeEvent.isComposing && (event.key === ' ' || event.code === 'Space')) {
      setDismissedSlashPanel(true);
    }
    if (isSlashPanelOpen && slashItems.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveSlashIndex((current) => (current + 1) % slashItems.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveSlashIndex((current) => (current - 1 + slashItems.length) % slashItems.length);
        return;
      }
      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
        event.preventDefault();
        const selected = slashItems[activeSlashIndex];
        if (selected) {
          handleSelectSlashItem(selected);
        }
        return;
      }
    }
    if (event.key === 'Escape') {
      if (isSlashPanelOpen) {
        event.preventDefault();
        setDismissedSlashPanel(true);
        return;
      }
      if (params.isSending && params.canStopGeneration) {
        event.preventDefault();
        void params.onStop();
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void params.onSend();
    }
  }, [activeSlashIndex, handleSelectSlashItem, isSlashPanelOpen, params, slashItems]);

  return {
    slashAnchorRef,
    slashListRef,
    isSlashPanelOpen,
    isSlashPanelLoading,
    resolvedSlashPanelWidth,
    skillSlashItems,
    activeSlashIndex,
    activeSlashItem,
    onSelectSlashItem: handleSelectSlashItem,
    onSlashPanelOpenChange: (open: boolean) => {
      if (!open) {
        setDismissedSlashPanel(true);
      }
    },
    onSetActiveSlashIndex: setActiveSlashIndex,
    onTextareaKeyDown
  };
}

export function useChatInputBarController(params: UseChatInputBarControllerParams) {
  const selectedSkillRecords = params.selectedSkills.map((spec) => {
    const matched = params.skillRecords.find((record) => record.spec === spec);
    return {
      spec,
      label: matched?.label || spec
    };
  });

  const slashController = useSlashPanelController({
    draft: params.draft,
    onDraftChange: params.onDraftChange,
    onSend: params.onSend,
    onStop: params.onStop,
    isSending: params.isSending,
    canStopGeneration: params.canStopGeneration,
    isSkillsLoading: params.isSkillsLoading,
    selectedSkills: params.selectedSkills,
    onSelectedSkillsChange: params.onSelectedSkillsChange,
    skillRecords: params.skillRecords
  });

  return {
    selectedSkillRecords,
    ...slashController
  };
}
