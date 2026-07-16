import { File, Folder } from 'lucide-react';
import type { ChatInputSurfacePathPreview as ChatInputSurfacePathPreviewViewModel } from '@agent-chat-ui/lib/input-surface';

export function ChatInputSurfacePathPreview({
  pathPreview,
}: {
  pathPreview: ChatInputSurfacePathPreviewViewModel;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
        <Folder aria-hidden="true" className="h-4 w-4 text-gray-400" />
        <span className="truncate">{pathPreview.rootLabel}</span>
      </div>
      <div className="mt-2">
        {pathPreview.segments.map((segment, index) => {
          const Icon = segment.kind === 'directory' ? Folder : File;
          return (
            <div
              key={`${index}:${segment.label}`}
              className="relative flex min-w-0 items-center gap-2 py-1 text-xs text-gray-700"
              style={{ paddingLeft: `${(index + 1) * 18}px` }}
            >
              <span
                aria-hidden="true"
                className="absolute bottom-1/2 top-[-0.25rem] w-px bg-gray-200"
                style={{ left: `${index * 18 + 7}px` }}
              />
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="truncate font-medium">{segment.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
