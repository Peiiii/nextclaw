import type {
  ChatSkillPickerOption,
  ChatSkillPickerOptionGroup,
  ChatSkillPickerProps,
  ChatSlashItem,
} from '@nextclaw/agent-chat-ui';
export {
  buildModelStateHint,
  buildModelToolbarSelect,
  buildThinkingToolbarSelect,
} from "./chat-input-toolbar.utils";
import type {
  ChatInputBarAdapterTexts,
  ChatSkillRecord,
} from "@/features/chat/types/chat-input-bar.types";

export type {
  ChatInputBarAdapterTexts,
  ChatModelRecord,
  ChatSkillRecord,
  ChatThinkingLevel,
} from "@/features/chat/types/chat-input-bar.types";

const SLASH_ITEM_MATCH_SCORE = {
  exactSpec: 1200,
  exactLabel: 1150,
  prefixSpec: 1000,
  prefixLabel: 950,
  prefixToken: 900,
  containsSpec: 800,
  containsLabel: 760,
  containsDescription: 500,
  subsequence: 300,
  fallback: 1
} as const;

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

function scoreSkillRecord(record: ChatSkillRecord, query: string): number {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return SLASH_ITEM_MATCH_SCORE.fallback;
  }

  const spec = normalizeSearchText(record.key);
  const label = normalizeSearchText(record.label || record.key);
  const description = normalizeSearchText(`${record.descriptionZh ?? ''} ${record.description ?? ''}`);
  const labelTokens = label.split(/[\s/_-]+/).filter(Boolean);

  if (spec === normalizedQuery) {
    return SLASH_ITEM_MATCH_SCORE.exactSpec;
  }
  if (label === normalizedQuery) {
    return SLASH_ITEM_MATCH_SCORE.exactLabel;
  }
  if (spec.startsWith(normalizedQuery)) {
    return SLASH_ITEM_MATCH_SCORE.prefixSpec;
  }
  if (label.startsWith(normalizedQuery)) {
    return SLASH_ITEM_MATCH_SCORE.prefixLabel;
  }
  if (labelTokens.some((token) => token.startsWith(normalizedQuery))) {
    return SLASH_ITEM_MATCH_SCORE.prefixToken;
  }
  if (spec.includes(normalizedQuery)) {
    return SLASH_ITEM_MATCH_SCORE.containsSpec;
  }
  if (label.includes(normalizedQuery)) {
    return SLASH_ITEM_MATCH_SCORE.containsLabel;
  }
  if (description.includes(normalizedQuery)) {
    return SLASH_ITEM_MATCH_SCORE.containsDescription;
  }
  if (isSubsequenceMatch(normalizedQuery, label) || isSubsequenceMatch(normalizedQuery, spec)) {
    return SLASH_ITEM_MATCH_SCORE.subsequence;
  }
  return 0;
}

function resolveSlashMatchTier(score: number): number {
  if (score >= SLASH_ITEM_MATCH_SCORE.exactLabel) {
    return 4;
  }
  if (score >= SLASH_ITEM_MATCH_SCORE.prefixToken) {
    return 3;
  }
  if (score >= SLASH_ITEM_MATCH_SCORE.containsLabel) {
    return 2;
  }
  if (score > 0) {
    return 1;
  }
  return 0;
}

function buildRecentOrderIndex(values: string[]): Map<string, number> {
  return new Map(values.map((value, index) => [value, index] as const));
}

function prioritizeSkillRecords(skillRecords: ChatSkillRecord[], recentSkillValues: string[]): ChatSkillRecord[] {
  const recentOrderIndex = buildRecentOrderIndex(recentSkillValues);
  const recentRecords: ChatSkillRecord[] = [];
  const remainingRecords: ChatSkillRecord[] = [];
  for (const record of skillRecords) {
    if (recentOrderIndex.has(record.key)) {
      recentRecords.push(record);
      continue;
    }
    remainingRecords.push(record);
  }
  recentRecords.sort(
    (left, right) => (recentOrderIndex.get(left.key) ?? Number.POSITIVE_INFINITY) - (recentOrderIndex.get(right.key) ?? Number.POSITIVE_INFINITY)
  );
  return [...recentRecords, ...remainingRecords];
}

export function buildChatSlashItems(
  skillRecords: ChatSkillRecord[],
  normalizedSlashQuery: string,
  texts: Pick<ChatInputBarAdapterTexts, 'slashSkillSubtitle' | 'slashSkillSpecLabel' | 'slashSkillScopeLabel' | 'noSkillDescription'>,
  recentSkillValues: string[] = []
): ChatSlashItem[] {
  const skillSortCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  const recentOrderIndex = buildRecentOrderIndex(recentSkillValues);
  const groupOrderIndex = new Map<string, number>();
  for (const record of skillRecords) {
    const groupKey = record.groupKey?.trim();
    if (groupKey && !groupOrderIndex.has(groupKey)) {
      groupOrderIndex.set(groupKey, groupOrderIndex.size);
    }
  }

  return skillRecords
    .map((record, order) => ({
      record,
      order,
      score: scoreSkillRecord(record, normalizedSlashQuery)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      const leftGroupIndex = groupOrderIndex.get(left.record.groupKey?.trim() ?? '') ?? Number.POSITIVE_INFINITY;
      const rightGroupIndex = groupOrderIndex.get(right.record.groupKey?.trim() ?? '') ?? Number.POSITIVE_INFINITY;
      if (leftGroupIndex !== rightGroupIndex) {
        return leftGroupIndex - rightGroupIndex;
      }
      const leftTier = resolveSlashMatchTier(left.score);
      const rightTier = resolveSlashMatchTier(right.score);
      if (rightTier !== leftTier) {
        return rightTier - leftTier;
      }
      const leftRecentIndex = recentOrderIndex.get(left.record.key) ?? Number.POSITIVE_INFINITY;
      const rightRecentIndex = recentOrderIndex.get(right.record.key) ?? Number.POSITIVE_INFINITY;
      if (leftRecentIndex !== rightRecentIndex) {
        return leftRecentIndex - rightRecentIndex;
      }
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      const leftLabel = (left.record.label || left.record.key).trim();
      const rightLabel = (right.record.label || right.record.key).trim();
      const labelCompare = skillSortCollator.compare(leftLabel, rightLabel);
      if (labelCompare !== 0) {
        return labelCompare;
      }
      return left.order - right.order;
    })
    .map(({ record }) => ({
      key: `skill:${record.key}`,
      title: record.label || record.key,
      subtitle: texts.slashSkillSubtitle,
      description: (record.descriptionZh ?? record.description ?? '').trim() || texts.noSkillDescription,
      detailLines: [
        `${texts.slashSkillSpecLabel}: ${record.key}`,
        ...(record.scopeLabel ? [`${texts.slashSkillScopeLabel}: ${record.scopeLabel}`] : [])
      ],
      sectionKey: record.groupKey,
      sectionLabel: record.groupLabel,
      tokenKind: 'skill',
      tokenKey: record.key,
      value: record.key
    }));
}

function buildSkillPickerOptions(skillRecords: ChatSkillRecord[]): ChatSkillPickerOption[] {
  return skillRecords.map((record) => ({
    key: record.key,
    label: record.label,
    description: record.descriptionZh || record.description || '',
    badgeLabel: record.badgeLabel
  }));
}

function buildSkillPickerGroups(params: {
  skillRecords: ChatSkillRecord[];
  recentKeySet: Set<string>;
  recentSkillsLabel: string;
  allSkillsLabel: string;
}): ChatSkillPickerOptionGroup[] | undefined {
  const { allSkillsLabel, recentKeySet, recentSkillsLabel, skillRecords } = params;
  const recentRecords = skillRecords.filter((record) => recentKeySet.has(record.key));
  const groupedRecords = new Map<string, { label: string; records: ChatSkillRecord[] }>();
  for (const record of skillRecords) {
    if (recentKeySet.has(record.key)) {
      continue;
    }
    const groupKey = record.groupKey?.trim() || 'all-skills';
    const groupLabel = record.groupLabel?.trim() || allSkillsLabel;
    const group = groupedRecords.get(groupKey) ?? { label: groupLabel, records: [] };
    group.records.push(record);
    groupedRecords.set(groupKey, group);
  }
  const sourceGroups = [...groupedRecords].map(([key, group]) => ({
    key,
    label: group.label,
    options: buildSkillPickerOptions(group.records),
  }));
  const hasSourceGroups = sourceGroups.some((group) => group.key !== 'all-skills');
  if (recentRecords.length === 0 && !hasSourceGroups) {
    return undefined;
  }
  return [
    ...(recentRecords.length > 0
      ? [{
          key: 'recent-skills',
          label: recentSkillsLabel,
          options: buildSkillPickerOptions(recentRecords),
        }]
      : []),
    ...sourceGroups,
  ].filter((group) => group.options.length > 0);
}

export function buildSkillPickerModel(params: {
  skillRecords: ChatSkillRecord[];
  recentSkillValues?: string[];
  groupedRecentSkillValues?: string[];
  selectedSkills: string[];
  isLoading: boolean;
  onSelectedKeysChange: (next: string[]) => void;
  texts: {
    title: string;
    searchPlaceholder: string;
    emptyLabel: string;
    loadingLabel: string;
    manageLabel: string;
    recentSkillsLabel: string;
    allSkillsLabel: string;
  };
}): ChatSkillPickerProps {
  const {
    groupedRecentSkillValues,
    isLoading,
    onSelectedKeysChange,
    recentSkillValues,
    selectedSkills,
    skillRecords,
    texts,
  } = params;
  const prioritizedSkillRecords = prioritizeSkillRecords(skillRecords, recentSkillValues ?? []);
  const recentKeySet = new Set(groupedRecentSkillValues ?? []);
  return {
    title: texts.title,
    allGroupsLabel: texts.allSkillsLabel,
    searchPlaceholder: texts.searchPlaceholder,
    emptyLabel: texts.emptyLabel,
    loadingLabel: texts.loadingLabel,
    isLoading,
    manageLabel: texts.manageLabel,
    manageHref: '/marketplace/skills',
    options: buildSkillPickerOptions(prioritizedSkillRecords),
    groups: buildSkillPickerGroups({
      skillRecords: prioritizedSkillRecords,
      recentKeySet,
      recentSkillsLabel: texts.recentSkillsLabel,
      allSkillsLabel: texts.allSkillsLabel,
    }),
    selectedKeys: selectedSkills,
    onSelectedKeysChange
  };
}
