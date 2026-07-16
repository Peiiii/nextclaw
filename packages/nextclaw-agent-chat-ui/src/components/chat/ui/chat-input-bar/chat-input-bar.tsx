import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import type {
  ChatInputBarProps,
  ChatInputSurfaceConfig,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { ChatInputSurfaceHost } from '@agent-chat-ui/components/chat/ui/input-surface/chat-input-surface-host';
import { ChatUiPrimitives } from '@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives';
import { ChatInputBarToolbar } from './chat-input-bar-toolbar';
import { ChatInputBarTokenizedComposer, type ChatInputBarTokenizedComposerHandle } from './chat-input-bar-tokenized-composer';

const SEND_ERROR_PREVIEW_MAX_CHARS = 120;

function buildSendErrorPreview(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length <= SEND_ERROR_PREVIEW_MAX_CHARS ? compact : `${compact.slice(0, SEND_ERROR_PREVIEW_MAX_CHARS - 1)}…`;
}

function InputBarHint({ hint }: { hint: ChatInputBarProps['hint'] }) {
  if (!hint) {
    return null;
  }

  if (hint.loading) {
    return (
      <div className="px-4 pb-2">
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
          <span className="h-3 w-28 animate-pulse rounded bg-muted-foreground/20" />
          <span className="h-3 w-16 animate-pulse rounded bg-muted-foreground/20" />
        </div>
      </div>
    );
  }

  const toneClassName =
    hint.tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-border bg-muted text-muted-foreground';

  return (
    <div className="px-4 pb-2">
      <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${toneClassName}`}>
        {hint.text ? <span>{hint.text}</span> : null}
        {hint.actionLabel && hint.onAction ? (
          <button
            type="button"
            onClick={hint.onAction}
            className="font-semibold underline-offset-2 hover:underline"
          >
            {hint.actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ChatInputBarSendError({ sendError, sendErrorDetailsLabel }: Pick<ChatInputBarProps, 'sendError' | 'sendErrorDetailsLabel'>) {
  const normalizedSendError = sendError?.trim() ?? '';
  if (!normalizedSendError) {
    return null;
  }

  const { Popover, PopoverContent, PopoverTrigger } = ChatUiPrimitives;
  const sendErrorPreview = buildSendErrorPreview(normalizedSendError);
  const resolvedSendErrorDetailsLabel = sendErrorDetailsLabel?.trim() || 'Details';

  return (
    <div className="px-3 pb-2 sm:px-4">
      <div
        aria-live="polite"
        className="flex min-w-0 items-start justify-between gap-3 rounded-lg border border-red-200/80 bg-red-50/80 px-3 py-2 text-xs text-red-700"
        role="status"
      >
        <span className="min-w-0 flex-1 truncate leading-5" title={normalizedSendError}>
          {sendErrorPreview}
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-7 shrink-0 items-center rounded-md border border-red-200/80 bg-background px-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              {resolvedSendErrorDetailsLabel}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(32rem,calc(100vw-1.5rem))] border-red-100/80 p-0">
            <div className="border-b border-red-100 bg-red-50/80 px-4 py-2 text-xs font-semibold text-red-700">
              {resolvedSendErrorDetailsLabel}
            </div>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words px-4 py-3 text-xs leading-relaxed text-red-700">
              {normalizedSendError}
            </pre>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export type ChatInputBarHandle = {
  insertFileToken: (tokenKey: string, label: string) => void;
  insertFileTokens: (tokens: Array<{ tokenKey: string; label: string }>) => void;
  focusComposer: () => void;
  focusComposerAtEnd: (nodes?: ChatInputBarProps['composer']['nodes']) => void;
};

export const ChatInputBar = forwardRef<ChatInputBarHandle, ChatInputBarProps>(function ChatInputBar(
  { composer, hint, inputSurface, sendError, sendErrorDetailsLabel, slashMenu, surface, toolbar: toolbarProps, topSlot },
  ref
) {
  const composerRef = useRef<ChatInputBarTokenizedComposerHandle | null>(null);
  const resolvedInputSurface: ChatInputSurfaceConfig | null = inputSurface ?? (slashMenu
      ? {
        isLoading: slashMenu.isLoading,
        filterOptions: slashMenu.filterOptions,
        items: slashMenu.items,
        onSelectItem: slashMenu.onSelectItem,
        texts: {
          loadingLabel: slashMenu.texts.slashLoadingLabel,
          sectionLabel: slashMenu.texts.slashSectionLabel,
          emptyLabel: slashMenu.texts.slashEmptyLabel,
          hintLabel: slashMenu.texts.slashHintLabel,
          itemHintLabel: slashMenu.texts.slashSkillHintLabel,
        },
      }
    : null);

  const toolbar = useMemo(() => {
    if (!toolbarProps.skillPicker) {
      return toolbarProps;
    }
    return {
      ...toolbarProps,
      skillPicker: {
        ...toolbarProps.skillPicker,
        onSelectedKeysChange: (nextKeys: string[]) => {
          composerRef.current?.syncSelectedSkills(nextKeys, toolbarProps.skillPicker?.options ?? []);
          toolbarProps.skillPicker?.onSelectedKeysChange(nextKeys);
        }
      }
    };
  }, [toolbarProps]);

  useImperativeHandle(ref, () => ({
    insertFileToken: (tokenKey, label) => composerRef.current?.insertFileToken(tokenKey, label),
    insertFileTokens: (tokens) => composerRef.current?.insertFileTokens(tokens),
    focusComposer: () => composerRef.current?.focusComposer(),
    focusComposerAtEnd: (nodes) => composerRef.current?.focusComposerAtEnd(nodes),
  }), []);
  const surfaceClassName =
    surface === 'embedded'
      ? 'bg-transparent px-0 py-0'
      : 'bg-background px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-2';

  return (
    <div className={surfaceClassName}>
      <div className="nextclaw-chat-input-bar-shell mx-auto w-full max-w-[min(1120px,100%)] [container:nextclaw-chat-input-bar/inline-size]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {topSlot ? (
            <div className="px-3 pb-0 pt-2 sm:px-4 sm:pt-2.5">
              {topSlot}
            </div>
          ) : null}
          <div className="relative">
            <ChatInputSurfaceHost
              inputSurface={resolvedInputSurface}
              onInputSurfaceTriggerChange={composer.onInputSurfaceTriggerChange}
              onSelectItem={(item) => {
                if (item.selectionBehavior === 'navigate') {
                  resolvedInputSurface?.onSelectItem?.(item);
                  return;
                }
                composerRef.current?.insertInputSurfaceItem(item, composer.inputSurfaceTriggerSpecs);
              }}
              triggerSpecs={composer.inputSurfaceTriggerSpecs}
            >
              {({
                onInputSurfaceKeyDown,
                onInputSurfaceOpenChange,
                onInputSurfaceSnapshotChange,
              }) => (
                <ChatInputBarTokenizedComposer
                  ref={composerRef}
                  nodes={composer.nodes}
                  placeholder={composer.placeholder}
                  disabled={composer.disabled}
                  onInputSurfaceItemSelect={resolvedInputSurface?.onSelectItem}
                  actions={toolbarProps.actions}
                  onNodesChange={composer.onNodesChange}
                  onFilesAdd={composer.onFilesAdd}
                  onInputSurfaceSnapshotChange={onInputSurfaceSnapshotChange}
                  onInputSurfaceOpenChange={onInputSurfaceOpenChange}
                  onInputSurfaceKeyDown={onInputSurfaceKeyDown}
                />
              )}
            </ChatInputSurfaceHost>
          </div>

          <InputBarHint hint={hint} />
          <ChatInputBarSendError sendError={sendError} sendErrorDetailsLabel={sendErrorDetailsLabel} />
          <ChatInputBarToolbar {...toolbar} />
        </div>
      </div>
    </div>
  );
});

ChatInputBar.displayName = 'ChatInputBar';
