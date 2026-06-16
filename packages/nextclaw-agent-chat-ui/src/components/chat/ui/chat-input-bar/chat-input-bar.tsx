import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ChatInputBarProps } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { ChatSlashMenu } from './chat-slash-menu';
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
  { composer, hint, slashMenu, surface, toolbar: toolbarProps },
  ref
) {
  const composerRef = useRef<ChatInputBarTokenizedComposerHandle | null>(null);
  const isSlashMenuInteractionRef = useRef(false);
  const [activeSlashIndex, setActiveSlashIndex] = useState(0);
  const [activeSlashTriggerStart, setActiveSlashTriggerStart] = useState<number | null>(null);
  const [dismissedSlashTriggerStart, setDismissedSlashTriggerStart] = useState<number | null>(null);
  const isSlashPanelOpen = activeSlashTriggerStart !== null && dismissedSlashTriggerStart !== activeSlashTriggerStart;
  const activeSlashIndexInRange =
    slashMenu.items.length === 0 ? 0 : Math.min(activeSlashIndex, slashMenu.items.length - 1);
  const activeSlashItem = slashMenu.items[activeSlashIndexInRange] ?? null;
  const dismissSlashTrigger = () => activeSlashTriggerStart !== null && !isSlashMenuInteractionRef.current
    ? setDismissedSlashTriggerStart(activeSlashTriggerStart)
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
              slashItems={slashMenu.items}
              onSlashItemSelect={slashMenu.onSelectItem}
              actions={toolbarProps.actions}
              activeSlashIndex={activeSlashIndexInRange}
              onNodesChange={composer.onNodesChange}
              onFilesAdd={composer.onFilesAdd}
              onSlashQueryChange={(query) => {
                if (query === null && isSlashMenuInteractionRef.current) return;
                if (query !== null) setActiveSlashIndex(0);
                composer.onSlashQueryChange?.(query);
              }}
              onSlashTriggerChange={(trigger) => {
                const nextTriggerStart = trigger?.start ?? null;
                setActiveSlashTriggerStart(nextTriggerStart);
                if (nextTriggerStart === null) {
                  setDismissedSlashTriggerStart(null);
                }
              }}
              onSlashOpenChange={(open) => {
                if (!open) dismissSlashTrigger();
              }}
              onSlashActiveIndexChange={setActiveSlashIndex}
            />
            <ChatSlashMenu
              isOpen={isSlashPanelOpen}
              isLoading={slashMenu.isLoading}
              items={slashMenu.items}
              activeIndex={activeSlashIndexInRange}
              activeItem={activeSlashItem}
              texts={slashMenu.texts}
              onSelectItem={(item) => {
                setDismissedSlashTriggerStart(null);
                composerRef.current?.insertSlashItem(item);
              }}
              onOpenChange={(open) => {
                if (!open) dismissSlashTrigger();
              }}
              onDetailsPointerDown={() => {
                isSlashMenuInteractionRef.current = true;
                requestAnimationFrame(() => { isSlashMenuInteractionRef.current = false; });
              }}
              onSetActiveIndex={setActiveSlashIndex}
            />
          </div>

          <InputBarHint hint={hint} />
          <ChatInputBarToolbar {...toolbar} />
        </div>
      </div>
    </div>
  );
});

ChatInputBar.displayName = 'ChatInputBar';
