import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ChatInputBarProps } from '../../view-models/chat-ui.types';
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
};

export const ChatInputBar = forwardRef<ChatInputBarHandle, ChatInputBarProps>(function ChatInputBar(props, ref) {
  const composerRef = useRef<ChatInputBarTokenizedComposerHandle | null>(null);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [activeSlashIndex, setActiveSlashIndex] = useState(0);
  const [activeSlashTriggerStart, setActiveSlashTriggerStart] = useState<number | null>(null);
  const [dismissedSlashTriggerStart, setDismissedSlashTriggerStart] = useState<number | null>(null);
  const isSlashPanelOpen = activeSlashTriggerStart !== null && dismissedSlashTriggerStart !== activeSlashTriggerStart;
  const activeSlashItem = props.slashMenu.items[activeSlashIndex] ?? null;

  useEffect(() => {
    setActiveSlashIndex((current) => {
      if (props.slashMenu.items.length === 0) {
        return 0;
      }
      return Math.min(current, props.slashMenu.items.length - 1);
    });
  }, [props.slashMenu.items.length]);

  useEffect(() => {
    if (slashQuery !== null) {
      setActiveSlashIndex(0);
    }
  }, [slashQuery]);

  useEffect(() => {
    if (activeSlashTriggerStart === null && dismissedSlashTriggerStart !== null) {
      setDismissedSlashTriggerStart(null);
    }
  }, [activeSlashTriggerStart, dismissedSlashTriggerStart]);

  const toolbar = useMemo(() => {
    if (!props.toolbar.skillPicker) {
      return props.toolbar;
    }
    return {
      ...props.toolbar,
      skillPicker: {
        ...props.toolbar.skillPicker,
        onSelectedKeysChange: (nextKeys: string[]) => {
          composerRef.current?.syncSelectedSkills(nextKeys, props.toolbar.skillPicker?.options ?? []);
          props.toolbar.skillPicker?.onSelectedKeysChange(nextKeys);
        }
      }
    };
  }, [props.toolbar]);

  useImperativeHandle(ref, () => ({
    insertFileToken: (tokenKey, label) => composerRef.current?.insertFileToken(tokenKey, label),
    insertFileTokens: (tokens) => composerRef.current?.insertFileTokens(tokens),
    focusComposer: () => composerRef.current?.focusComposer(),
  }), []);

  return (
    <div className="border-t border-gray-200/80 bg-white p-4">
      <div className="mx-auto w-full max-w-[min(1120px,100%)]">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card">
          <div className="relative">
            <ChatInputBarTokenizedComposer
              ref={composerRef}
              nodes={props.composer.nodes}
              placeholder={props.composer.placeholder}
              disabled={props.composer.disabled}
              slashItems={props.slashMenu.items}
              onSlashItemSelect={props.slashMenu.onSelectItem}
              actions={props.toolbar.actions}
              activeSlashIndex={activeSlashIndex}
              onNodesChange={props.composer.onNodesChange}
              onFilesAdd={props.composer.onFilesAdd}
              onSlashQueryChange={(query) => {
                setSlashQuery(query);
                props.composer.onSlashQueryChange?.(query);
              }}
              onSlashTriggerChange={(trigger) => {
                setActiveSlashTriggerStart(trigger?.start ?? null);
              }}
              onSlashOpenChange={(open) => {
                if (!open && activeSlashTriggerStart !== null) {
                  setDismissedSlashTriggerStart(activeSlashTriggerStart);
                }
              }}
              onSlashActiveIndexChange={setActiveSlashIndex}
            />
            <ChatSlashMenu
              isOpen={isSlashPanelOpen}
              isLoading={props.slashMenu.isLoading}
              items={props.slashMenu.items}
              activeIndex={activeSlashIndex}
              activeItem={activeSlashItem}
              texts={props.slashMenu.texts}
              onSelectItem={(item) => {
                setDismissedSlashTriggerStart(null);
                composerRef.current?.insertSlashItem(item);
              }}
              onOpenChange={(open) => {
                if (!open && activeSlashTriggerStart !== null) {
                  setDismissedSlashTriggerStart(activeSlashTriggerStart);
                }
              }}
              onSetActiveIndex={setActiveSlashIndex}
            />
          </div>

          <InputBarHint hint={props.hint} />
          <ChatInputBarToolbar {...toolbar} />
        </div>
      </div>
    </div>
  );
});

ChatInputBar.displayName = 'ChatInputBar';
