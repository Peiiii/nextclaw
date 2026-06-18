import { ChatInputSurfaceMenu } from '@agent-chat-ui/components/chat/ui/input-surface/chat-input-surface-menu';
import type { ChatSlashMenuProps } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

export function ChatSlashMenu(props: ChatSlashMenuProps) {
  const { texts, ...rest } = props;
  return (
    <ChatInputSurfaceMenu
      {...rest}
      texts={{
        loadingLabel: texts.slashLoadingLabel,
        sectionLabel: texts.slashSectionLabel,
        emptyLabel: texts.slashEmptyLabel,
        hintLabel: texts.slashHintLabel,
        itemHintLabel: texts.slashSkillHintLabel,
      }}
    />
  );
}
