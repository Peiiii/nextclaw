import {
  CHAT_INPUT_SURFACE_SLASH_TRIGGER_SPEC,
  createInputSurfaceReferenceTokenPlugin,
  type ChatInputSurfaceMenuTexts,
  type ChatInputSurfacePlugin,
} from '@nextclaw/agent-chat-ui';
import { buildChatSlashItems } from '@/features/chat/features/input/utils/chat-input-bar.utils';
import type { ChatInputProductPluginData } from './chat-input-product-plugin-adapters.types';
import type { ChatInputBarAdapterTexts } from '@/features/chat/types/chat-input-bar.types';

export function createSkillReferenceInputSurfacePlugin(params: {
  menuTexts: ChatInputSurfaceMenuTexts;
  itemTexts: Pick<
    ChatInputBarAdapterTexts,
    'slashSkillSubtitle' | 'slashSkillSpecLabel' | 'slashSkillScopeLabel' | 'noSkillDescription'
  >;
  onSelectSkill?: (skillRef: string) => void;
}): ChatInputSurfacePlugin<ChatInputProductPluginData> {
  return createInputSurfaceReferenceTokenPlugin({
    key: 'skill-reference',
    trigger: CHAT_INPUT_SURFACE_SLASH_TRIGGER_SPEC,
    tokenKind: 'skill',
    texts: params.menuTexts,
    getIsLoading: ({ data }) => data.isSkillsLoading,
    getRecords: ({ data }) => data.skillRecords,
    getItems: ({ context }) =>
      buildChatSlashItems(
        [...context.data.skillRecords],
        context.trigger.query,
        params.itemTexts,
        [...context.data.recentSkillValues],
      ),
    onSelectItem: (item) => {
      const skillRef = item.tokenKey ?? item.value;
      if (skillRef) {
        params.onSelectSkill?.(skillRef);
      }
    },
  });
}
