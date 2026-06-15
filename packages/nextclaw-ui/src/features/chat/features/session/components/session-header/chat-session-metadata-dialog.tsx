import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { t } from '@/shared/lib/i18n';

type ChatSessionMetadataDialogProps = {
  open: boolean;
  metadata?: Record<string, unknown> | null;
  onOpenChange: (open: boolean) => void;
};

function formatSessionMetadata(metadata?: Record<string, unknown> | null): string {
  try {
    return JSON.stringify(metadata ?? {}, null, 2);
  } catch {
    return '{}';
  }
}

export function ChatSessionMetadataDialog({
  open,
  metadata,
  onOpenChange,
}: ChatSessionMetadataDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-gray-200 px-5 py-4 pr-12">
          <DialogTitle className="text-base">{t('chatSessionMetadataDialogTitle')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('chatSessionMetadataDialogDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 pb-5 pt-4">
          <pre className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200 bg-gray-950 p-4 text-xs leading-relaxed text-gray-100">
            {formatSessionMetadata(metadata)}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
