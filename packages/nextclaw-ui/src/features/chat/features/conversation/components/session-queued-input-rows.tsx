import type { ReactNode } from 'react';
import { CornerDownRight, Pencil, Trash2 } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { t } from '@/shared/lib/i18n';
import type {
  SessionConversationQueuedInput,
} from '@/features/chat/features/conversation/hooks/use-session-conversation-controller';

type SessionQueuedInputRowsController = {
  readonly deleteQueuedInput: (id: string) => void;
  readonly editQueuedInput: (id: string) => void;
  readonly queuedInputs: readonly SessionConversationQueuedInput[];
};

type SessionQueuedInputRowsProps = {
  readonly controller: SessionQueuedInputRowsController;
};

type QueuedInputIconButtonProps = {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onClick: () => void;
};

function QueuedInputIconButton({
  children,
  disabled = false,
  label,
  onClick,
}: QueuedInputIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <button
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border disabled:cursor-not-allowed disabled:text-muted-foreground/50"
          >
            {children}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function SessionQueuedInputRows({
  controller,
}: SessionQueuedInputRowsProps) {
  if (controller.queuedInputs.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-col gap-0.5">
        {controller.queuedInputs.map((item) => (
          <div
            key={item.id}
            className="flex min-h-8 min-w-0 items-center gap-2 text-sm"
          >
            <CornerDownRight className="h-4 w-4 shrink-0 text-muted-foreground/70" />
            <span className="min-w-0 flex-1 truncate font-medium text-foreground/80">
              {item.preview || t('chatQueuedBannerAttachmentFallback')}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <QueuedInputIconButton
                label={t('chatQueuedEdit')}
                onClick={() => controller.editQueuedInput(item.id)}
              >
                <Pencil className="h-4 w-4" />
              </QueuedInputIconButton>
              <QueuedInputIconButton
                label={t('chatQueuedDelete')}
                onClick={() => controller.deleteQueuedInput(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </QueuedInputIconButton>
            </div>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
