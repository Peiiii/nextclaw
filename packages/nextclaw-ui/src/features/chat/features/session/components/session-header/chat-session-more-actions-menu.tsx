import { PageResourceActionItems } from '@/features/right-panel-resources';
import { pageResourceFromTarget } from '@/features/right-panel-resources';
import { buildSessionPanelUrl } from '@/features/chat/features/session/utils/chat-session-route.utils';
import { Children, isValidElement, useState, type ReactNode } from 'react';
import { copyText } from '@nextclaw/agent-chat-ui';
import { Copy, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { ChatPopoverContent } from '@/features/chat/components/chat-popover-content';
import {
  IconActionButton,
  type IconActionButtonSize,
  type IconActionButtonTone,
} from '@/shared/components/ui/actions/icon-action-button';
import { Popover, PopoverTrigger } from '@/shared/components/ui/popover';
import { t } from '@/shared/lib/i18n';
import { ChatSessionHeaderMenuItem } from './chat-session-header-menu-item';

type ChatSessionMoreActionsMenuProps = {
  sessionKey: string;
  sessionTitle?: string;
  children?: ReactNode;
  disabled?: boolean;
  triggerSize?: IconActionButtonSize;
  triggerTone?: IconActionButtonTone;
  className?: string;
};

export async function copySessionId(sessionKey: string) {
  const copied = await copyText(sessionKey);
  toast[copied ? 'success' : 'error'](
    t(copied ? 'chatSessionCopyIdSuccess' : 'chatSessionCopyIdFailed'),
  );
}

export function ChatSessionMoreActionsMenu({
  sessionKey,
  sessionTitle,
  children,
  disabled = false,
  triggerSize = 'md',
  triggerTone = 'default',
  className,
}: ChatSessionMoreActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuItems = Children.toArray(children);
  const isDestructive = (item: ReactNode) => isValidElement<{ destructive?: boolean }>(item) && item.props.destructive;
  const destructiveItems = menuItems.filter(isDestructive);

  const handleCopySessionId = () => {
    setIsOpen(false);
    void copySessionId(sessionKey);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <IconActionButton
          icon={<MoreVertical className="h-4 w-4" />}
          label={t('chatSessionMoreActions')}
          size={triggerSize}
          tone={triggerTone}
          className={className}
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
        />
      </PopoverTrigger>
      <ChatPopoverContent align="end" variant="menu">
        <div onClick={() => setIsOpen(false)}>
          {menuItems.filter((item) => !isDestructive(item))}
          <ChatSessionHeaderMenuItem
            icon={Copy}
            label={t('chatSessionCopyId')}
            onClick={handleCopySessionId}
            disabled={disabled}
          />
        </div>
        <div className="my-1 h-px bg-border" />
          <PageResourceActionItems page={pageResourceFromTarget({ kind: 'chat-session', title: sessionTitle || t('chatFloatingConversation'), url: buildSessionPanelUrl(sessionKey), resourceUri: buildSessionPanelUrl(sessionKey), historyPolicy: 'none' })} onSelect={() => setIsOpen(false)} />
        {destructiveItems.length > 0 ? <>
          <div className="my-1 h-px bg-border" />
          <div onClick={() => setIsOpen(false)}>{destructiveItems}</div>
        </> : null}
      </ChatPopoverContent>
    </Popover>
  );
}
