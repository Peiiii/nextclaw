import {
  CHAT_INPUT_SURFACE_SLASH_TRIGGER_SPEC,
  createInputSurfaceTriggeredPanelPlugin,
  type ChatInputSurfaceItem,
  type ChatInputSurfaceMenuTexts,
  type ChatInputSurfacePlugin,
} from '@nextclaw/agent-chat-ui';
import { buildChatSlashItems } from '@/features/chat/features/input/utils/chat-input-bar.utils';
import type { ChatInputProductPluginData } from './chat-input-product-plugin-adapters.types';
import type { ChatInputBarAdapterTexts } from '@/features/chat/types/chat-input-bar.types';
import {
  resolveInputSurfaceMatchTier,
  scoreInputSurfaceSearchCandidate,
} from './input-surface-search.utils';

const SLASH_COMMAND_SECTION_KEY = 'commands';
const SLASH_SKILL_SECTION_KEY = 'skills';

export type ChatSlashCommandDescriptor = {
  key: string;
  title: string;
  description: string;
  detailLines?: readonly string[];
  keywords?: readonly string[];
  onSelect: () => void;
};

function buildSlashCommandItems(params: {
  commands: readonly ChatSlashCommandDescriptor[];
  query: string;
  texts: {
    commandHintLabel: string;
    commandSubtitle: string;
    commandSectionLabel: string;
  };
}): ChatInputSurfaceItem[] {
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  return params.commands
    .map((command, order) => ({
      command,
      order,
      score: scoreInputSurfaceSearchCandidate(
        {
          id: command.key,
          label: command.title,
          description: command.description,
          aliases: command.keywords,
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
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return collator.compare(left.command.title, right.command.title) || left.order - right.order;
    })
    .map(({ command }) => ({
      key: `command:${command.key}`,
      title: command.title,
      subtitle: params.texts.commandSubtitle,
      description: command.description,
      detailLines: [...(command.detailLines ?? [])],
      hintLabel: params.texts.commandHintLabel,
      sectionKey: SLASH_COMMAND_SECTION_KEY,
      sectionLabel: params.texts.commandSectionLabel,
    }));
}

function buildSlashSkillItems(params: {
  data: ChatInputProductPluginData;
  itemTexts: Pick<
    ChatInputBarAdapterTexts,
    'slashSkillSubtitle' | 'slashSkillSpecLabel' | 'slashSkillScopeLabel' | 'noSkillDescription'
  >;
  skillHintLabel: string;
  skillSectionLabel: string;
  query: string;
}): ChatInputSurfaceItem[] {
  const {
    data,
    itemTexts,
    query,
    skillHintLabel,
    skillSectionLabel,
  } = params;
  return buildChatSlashItems(
    [...data.skillRecords],
    query,
    itemTexts,
    [...data.recentSkillValues],
  ).map((item) => ({
    ...item,
    hintLabel: skillHintLabel,
    sectionKey: SLASH_SKILL_SECTION_KEY,
    sectionLabel: skillSectionLabel,
  }));
}

export function createSlashCommandInputSurfacePlugin(params: {
  commands: readonly ChatSlashCommandDescriptor[];
  menuTexts: ChatInputSurfaceMenuTexts;
  itemTexts: Pick<
    ChatInputBarAdapterTexts,
    'slashSkillSubtitle' | 'slashSkillSpecLabel' | 'slashSkillScopeLabel' | 'noSkillDescription'
  >;
  labels: {
    commandHintLabel: string;
    commandSectionLabel: string;
    commandSubtitle: string;
    skillHintLabel: string;
    skillSectionLabel: string;
  };
  onSelectSkill?: (skillRef: string) => void;
}): ChatInputSurfacePlugin<ChatInputProductPluginData> {
  return createInputSurfaceTriggeredPanelPlugin({
    key: 'slash-command',
    trigger: CHAT_INPUT_SURFACE_SLASH_TRIGGER_SPEC,
    resolvePanel: (context) => {
      const { data, trigger } = context;
      return {
        isLoading: data.isSkillsLoading,
        items: [
          ...buildSlashCommandItems({
            commands: params.commands,
            query: trigger.query,
            texts: {
              commandHintLabel: params.labels.commandHintLabel,
              commandSectionLabel: params.labels.commandSectionLabel,
              commandSubtitle: params.labels.commandSubtitle,
            },
          }),
          ...buildSlashSkillItems({
            data,
            itemTexts: params.itemTexts,
            query: trigger.query,
            skillHintLabel: params.labels.skillHintLabel,
            skillSectionLabel: params.labels.skillSectionLabel,
          }),
        ],
        onSelectItem: (item) => {
          if (item.key.startsWith('command:')) {
            params.commands.find((command) => item.key === `command:${command.key}`)?.onSelect();
            return;
          }
          const skillRef = item.tokenKey ?? item.value;
          if (skillRef) {
            params.onSelectSkill?.(skillRef);
          }
        },
        texts: params.menuTexts,
      };
    },
  });
}
