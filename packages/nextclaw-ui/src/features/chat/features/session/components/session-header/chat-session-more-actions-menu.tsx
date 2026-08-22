import { useState, type ReactNode } from 'react';
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
  children,
  disabled = false,
  triggerSize = 'md',
  triggerTone = 'default',
  className,
}: ChatSessionMoreActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

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
          tooltip={false}
          size={triggerSize}
          tone={triggerTone}
          className={className}
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
        />
      </PopoverTrigger>
      <ChatPopoverContent align="end" className="w-56 p-2">
        <div className="space-y-1" onClick={() => setIsOpen(false)}>
          <ChatSessionHeaderMenuItem
            icon={Copy}
            label={t('chatSessionCopyId')}
            onClick={handleCopySessionId}
            disabled={disabled}
          />
          {children}
        </div>
      </ChatPopoverContent>
    </Popover>
  );
}
