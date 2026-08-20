import type { ReactNode } from 'react';
import {
  CornerDownRight,
  Forward,
  LoaderCircle,
  Paperclip,
  Pencil,
  Trash2,
} from 'lucide-react';

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
  readonly canEditQueuedInput: boolean;
  readonly deleteQueuedInput: (id: string) => void;
  readonly editQueuedInput: (id: string) => void;
  readonly queuedInputs: readonly SessionConversationQueuedInput[];
  readonly steerQueuedInput: (id: string) => void;
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

function QueuedInputContent({ item }: { readonly item: SessionConversationQueuedInput }) {
  const attachments = item.attachments ?? [];
  const visibleAttachments = attachments.slice(0, 3);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {visibleAttachments.map((attachment, index) => attachment.previewUrl ? (
        <img
          key={`${attachment.name}-${index}`}
          alt={attachment.name}
          loading="lazy"
          src={attachment.previewUrl}
          title={attachment.name}
          className="h-9 w-9 shrink-0 rounded-md border border-border/70 object-cover"
        />
      ) : (
        <span
          key={`${attachment.name}-${index}`}
          title={attachment.name}
          className="inline-flex min-w-0 max-w-36 shrink items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
        >
          <Paperclip className="h-3 w-3 shrink-0" />
          <span className="truncate">{attachment.name}</span>
        </span>
      ))}
      {attachments.length > visibleAttachments.length ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          +{attachments.length - visibleAttachments.length}
        </span>
      ) : null}
      {item.preview || attachments.length === 0 ? (
        <span className="min-w-0 flex-1 truncate font-medium text-foreground/80">
          {item.preview || t('chatQueuedBannerAttachmentFallback')}
        </span>
      ) : null}
    </div>
  );
}

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
            <QueuedInputContent item={item} />
            {item.isSubmitting ? (
              <span
                aria-label={t('chatQueuedSubmitting')}
                className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
              >
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                {t('chatQueuedSubmitting')}
              </span>
            ) : (
              <div className="flex shrink-0 items-center gap-1.5">
                <QueuedInputIconButton
                  disabled={!controller.canEditQueuedInput}
                  label={controller.canEditQueuedInput
                    ? t('chatQueuedEdit')
                    : t('chatQueuedEditComposerNotEmpty')}
                  onClick={() => controller.editQueuedInput(item.id)}
                >
                  <Pencil className="h-4 w-4" />
                </QueuedInputIconButton>
                <QueuedInputIconButton
                  label={t('chatQueuedSteer')}
                  onClick={() => controller.steerQueuedInput(item.id)}
                >
                  <Forward className="h-4 w-4" />
                </QueuedInputIconButton>
                <QueuedInputIconButton
                  label={t('chatQueuedDelete')}
                  onClick={() => controller.deleteQueuedInput(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </QueuedInputIconButton>
              </div>
            )}
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
