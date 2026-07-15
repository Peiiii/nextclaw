import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from 'react';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import type {
  ChatComposerNode,
  ChatComposerSelection,
  ChatInputSurfaceItem,
  ChatInputSurfaceTriggerChangeReason,
  ChatInputSurfaceTriggerSpec,
  ChatInputBarActionsProps,
  ChatSkillPickerOption,
  ChatSlashItem,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import {
  writeChatComposerStateToLexicalRoot,
} from './chat-composer-lexical-adapter';
import { ChatComposerLexicalOwner } from './owners/chat-composer-lexical-owner';
import { ChatComposerBindingsPlugin } from './chat-composer-plugins';
import { ChatComposerTokenNode } from './chat-composer-token-node';

export type ChatInputBarTokenizedComposerHandle = {
  insertInputSurfaceItem: (
    item: ChatInputSurfaceItem,
    triggerSpecs?: readonly ChatInputSurfaceTriggerSpec[],
  ) => void;
  insertSlashItem: (item: ChatSlashItem) => void;
  insertFileToken: (tokenKey: string, label: string) => void;
  insertFileTokens: (tokens: Array<{ tokenKey: string; label: string }>) => void;
  focusComposer: () => void;
  focusComposerAtEnd: (nodes?: ChatComposerNode[]) => void;
  syncSelectedSkills: (nextKeys: string[], options: ChatSkillPickerOption[]) => void;
};

type ChatInputBarTokenizedComposerProps = {
  nodes: ChatComposerNode[];
  placeholder: string;
  disabled: boolean;
  onInputSurfaceItemSelect?: (item: ChatInputSurfaceItem) => void;
  actions: Pick<ChatInputBarActionsProps, 'onSend' | 'onStop' | 'isSending' | 'canStopGeneration'>;
  onNodesChange: (nodes: ChatComposerNode[]) => void;
  onFilesAdd?: (files: File[]) => Promise<void> | void;
  onInputSurfaceSnapshotChange?: (
    nodes: ChatComposerNode[],
    selection: ChatComposerSelection | null,
    reason: ChatInputSurfaceTriggerChangeReason,
  ) => void;
  onInputSurfaceOpenChange?: (open: boolean) => void;
  onInputSurfaceKeyDown?: (event: KeyboardEvent) => boolean;
};

export const ChatInputBarTokenizedComposer = forwardRef<
  ChatInputBarTokenizedComposerHandle,
  ChatInputBarTokenizedComposerProps
>(function ChatInputBarTokenizedComposer(
  {
    actions,
    disabled,
    nodes,
    onFilesAdd,
    onInputSurfaceItemSelect,
    onInputSurfaceKeyDown,
    onInputSurfaceOpenChange,
    onInputSurfaceSnapshotChange,
    onNodesChange,
    placeholder,
  },
  ref,
) {
  const [owner] = useState(() => new ChatComposerLexicalOwner());
  const ownerCallbacks = useMemo(
    () => ({
      onInputSurfaceItemSelect,
      onInputSurfaceKeyDown,
      onInputSurfaceOpenChange,
      onInputSurfaceSnapshotChange,
      onNodesChange,
    }),
    [
      onInputSurfaceItemSelect,
      onInputSurfaceKeyDown,
      onInputSurfaceOpenChange,
      onInputSurfaceSnapshotChange,
      onNodesChange,
    ],
  );
  owner.configureRuntime({
    actions,
    callbacks: ownerCallbacks,
    fallbackNodes: nodes,
  });

  useImperativeHandle(
    ref,
    () => owner.createHandle(),
    [owner],
  );

  const initialConfig = useMemo(
    () => ({
      editable: !disabled,
      editorState: () => {
        writeChatComposerStateToLexicalRoot(nodes, null);
      },
      namespace: 'NextClawChatComposerLexical',
      nodes: [ChatComposerTokenNode],
      onError: (error: Error) => {
        throw error;
      },
      theme: {},
    }),
    [disabled, nodes],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="min-h-11 sm:min-h-[60px]">
          <PlainTextPlugin
            contentEditable={
              <ContentEditable
                className="min-h-7 max-h-[188px] w-full overflow-y-auto whitespace-pre-wrap break-words bg-transparent py-0.5 text-sm leading-6 text-foreground outline-none"
                onBeforeInput={(event: FormEvent<HTMLDivElement>) => {
                  owner.handleBeforeInput({
                    disabled,
                    event,
                  });
                }}
                onPaste={(event: ClipboardEvent<HTMLDivElement>) => {
                  const files = Array.from(event.clipboardData.files ?? []);
                  if (files.length > 0 && onFilesAdd) {
                    event.preventDefault();
                    void onFilesAdd(files);
                  }
                }}
              />
            }
            placeholder={
              <div className="pointer-events-none absolute left-3 top-2 select-none text-sm leading-6 text-muted-foreground/60 sm:left-4 sm:top-2.5">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </div>
      <ChatComposerBindingsPlugin
        disabled={disabled}
        nodes={nodes}
        owner={owner}
      />
    </LexicalComposer>
  );
});

ChatInputBarTokenizedComposer.displayName = 'LexicalChatInputBarTokenizedComposer';
