import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type {
  ChatInputBarProps,
  ChatInputSurfaceConfig,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { ChatInputSurfaceMenu } from '@agent-chat-ui/components/chat/ui/input-surface/chat-input-surface-menu';
import { ChatInputBarToolbar } from './chat-input-bar-toolbar';
import { ChatInputBarTokenizedComposer, type ChatInputBarTokenizedComposerHandle } from './chat-input-bar-tokenized-composer';

function InputBarHint({ hint }: { hint: ChatInputBarProps['hint'] }) {
  if (!hint) {
    return null;
  }

  if (hint.loading) {
    return (
      <div className="px-4 pb-2">
        <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="h-3 w-28 animate-pulse rounded bg-gray-200" />
          <span className="h-3 w-16 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  const toneClassName =
    hint.tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-gray-200 bg-gray-50 text-gray-700';

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

export type ChatInputBarHandle = {
  insertFileToken: (tokenKey: string, label: string) => void;
  insertFileTokens: (tokens: Array<{ tokenKey: string; label: string }>) => void;
  focusComposer: () => void;
  focusComposerAtEnd: (nodes?: ChatInputBarProps['composer']['nodes']) => void;
};

export const ChatInputBar = forwardRef<ChatInputBarHandle, ChatInputBarProps>(function ChatInputBar(
  { composer, hint, inputSurface, slashMenu, surface, toolbar: toolbarProps },
  ref
) {
  const composerRef = useRef<ChatInputBarTokenizedComposerHandle | null>(null);
  const isInputSurfaceMenuInteractionRef = useRef(false);
  const [activeInputSurfaceIndex, setActiveInputSurfaceIndex] = useState(0);
  const [activeInputSurfaceTriggerStart, setActiveInputSurfaceTriggerStart] = useState<number | null>(null);
  const [dismissedInputSurfaceTriggerStart, setDismissedInputSurfaceTriggerStart] = useState<number | null>(null);
  const resolvedInputSurface: ChatInputSurfaceConfig | null = inputSurface ?? (slashMenu
    ? {
        isLoading: slashMenu.isLoading,
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
  const inputSurfaceItems = resolvedInputSurface?.items ?? [];
  const isInputSurfacePanelOpen =
    Boolean(resolvedInputSurface) &&
    activeInputSurfaceTriggerStart !== null &&
    dismissedInputSurfaceTriggerStart !== activeInputSurfaceTriggerStart;
  const activeInputSurfaceIndexInRange =
    inputSurfaceItems.length === 0 ? 0 : Math.min(activeInputSurfaceIndex, inputSurfaceItems.length - 1);
  const activeInputSurfaceItem = inputSurfaceItems[activeInputSurfaceIndexInRange] ?? null;
  const dismissInputSurfaceTrigger = () => activeInputSurfaceTriggerStart !== null && !isInputSurfaceMenuInteractionRef.current
    ? setDismissedInputSurfaceTriggerStart(activeInputSurfaceTriggerStart)
    : undefined;

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
      : 'border-t border-gray-200/80 bg-white px-3 py-3 sm:px-4 sm:py-4';

  return (
    <div className={surfaceClassName}>
      <div className="nextclaw-chat-input-bar-shell mx-auto w-full max-w-[min(1120px,100%)] [container:nextclaw-chat-input-bar/inline-size]">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card">
          <div className="relative">
            <ChatInputBarTokenizedComposer
              ref={composerRef}
              nodes={composer.nodes}
              placeholder={composer.placeholder}
              disabled={composer.disabled}
              slashItems={inputSurfaceItems}
              inputSurfaceTriggerSpecs={composer.inputSurfaceTriggerSpecs}
              onSlashItemSelect={resolvedInputSurface?.onSelectItem}
              actions={toolbarProps.actions}
              activeSlashIndex={activeInputSurfaceIndexInRange}
              onNodesChange={composer.onNodesChange}
              onFilesAdd={composer.onFilesAdd}
              onInputSurfaceTriggerChange={composer.onInputSurfaceTriggerChange}
              onSlashQueryChange={(query) => {
                if (query === null && isInputSurfaceMenuInteractionRef.current) return;
                if (query !== null) setActiveInputSurfaceIndex(0);
                composer.onSlashQueryChange?.(query);
              }}
              onSlashTriggerChange={(trigger) => {
                const nextTriggerStart = trigger?.start ?? null;
                setActiveInputSurfaceTriggerStart(nextTriggerStart);
                if (nextTriggerStart === null) {
                  setDismissedInputSurfaceTriggerStart(null);
                }
              }}
              onSlashOpenChange={(open) => {
                if (!open) dismissInputSurfaceTrigger();
              }}
              onSlashActiveIndexChange={setActiveInputSurfaceIndex}
            />
            {resolvedInputSurface ? (
              <ChatInputSurfaceMenu
                isOpen={isInputSurfacePanelOpen}
                isLoading={resolvedInputSurface.isLoading}
                items={inputSurfaceItems}
                activeIndex={activeInputSurfaceIndexInRange}
                activeItem={activeInputSurfaceItem}
                texts={resolvedInputSurface.texts}
                onSelectItem={(item) => {
                  setDismissedInputSurfaceTriggerStart(null);
                  composerRef.current?.insertInputSurfaceItem(item);
                }}
                onOpenChange={(open) => {
                  if (!open) dismissInputSurfaceTrigger();
                }}
                onDetailsPointerDown={() => {
                  isInputSurfaceMenuInteractionRef.current = true;
                  requestAnimationFrame(() => { isInputSurfaceMenuInteractionRef.current = false; });
                }}
                onSetActiveIndex={setActiveInputSurfaceIndex}
              />
            ) : null}
          </div>

          <InputBarHint hint={hint} />
          <ChatInputBarToolbar {...toolbar} />
        </div>
      </div>
    </div>
  );
});

ChatInputBar.displayName = 'ChatInputBar';
