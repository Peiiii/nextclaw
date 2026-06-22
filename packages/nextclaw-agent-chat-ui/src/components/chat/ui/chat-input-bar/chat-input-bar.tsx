import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import type {
  ChatInputBarProps,
  ChatInputSurfaceConfig,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { ChatInputSurfaceHost } from '@agent-chat-ui/components/chat/ui/input-surface/chat-input-surface-host';
import { ChatInputBarToolbar } from './chat-input-bar-toolbar';
import { ChatInputBarTokenizedComposer, type ChatInputBarTokenizedComposerHandle } from './chat-input-bar-tokenized-composer';

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
          <div className="relative">
            <ChatInputSurfaceHost
              inputSurface={resolvedInputSurface}
              onInputSurfaceTriggerChange={composer.onInputSurfaceTriggerChange}
              onSelectItem={(item) => composerRef.current?.insertInputSurfaceItem(item, composer.inputSurfaceTriggerSpecs)}
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
          <ChatInputBarToolbar {...toolbar} />
        </div>
      </div>
    </div>
  );
});

ChatInputBar.displayName = 'ChatInputBar';
