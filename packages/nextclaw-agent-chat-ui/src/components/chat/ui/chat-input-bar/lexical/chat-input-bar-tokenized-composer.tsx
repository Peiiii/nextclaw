import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  type ClipboardEvent,
  type FormEvent,
} from 'react';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { EditorRefPlugin } from '@lexical/react/LexicalEditorRefPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import type {
  ChatComposerNode,
  ChatComposerSelection,
  ChatInputBarActionsProps,
  ChatSkillPickerOption,
  ChatSlashItem,
} from '../../../view-models/chat-ui.types';
import { resolveChatComposerSlashTrigger } from '../chat-composer.utils';
import {
  getChatComposerNodesSignature,
  readChatComposerSnapshotFromEditorState,
  syncLexicalSelectionFromChatComposerSelection,
  writeChatComposerStateToLexicalRoot,
} from './chat-composer-lexical-adapter';
import {
  createLexicalComposerHandle,
  handleLexicalComposerBeforeInput,
  handleLexicalComposerCompositionEnd,
  handleLexicalComposerKeyboardCommand,
} from './chat-composer-lexical-controller';
import { ChatComposerBindingsPlugin } from './chat-composer-plugins';
import { ChatComposerTokenNode } from './chat-composer-token-node';

export type ChatInputBarTokenizedComposerHandle = {
  insertSlashItem: (item: ChatSlashItem) => void;
  insertFileToken: (tokenKey: string, label: string) => void;
  insertFileTokens: (tokens: Array<{ tokenKey: string; label: string }>) => void;
  focusComposer: () => void;
  syncSelectedSkills: (nextKeys: string[], options: ChatSkillPickerOption[]) => void;
};

type ChatInputBarTokenizedComposerProps = {
  nodes: ChatComposerNode[];
  placeholder: string;
  disabled: boolean;
  slashItems: ChatSlashItem[];
  onSlashItemSelect?: (item: ChatSlashItem) => void;
  actions: Pick<ChatInputBarActionsProps, 'onSend' | 'onStop' | 'isSending' | 'canStopGeneration'>;
  onNodesChange: (nodes: ChatComposerNode[]) => void;
  onFilesAdd?: (files: File[]) => Promise<void> | void;
  onSlashQueryChange?: (query: string | null) => void;
  onSlashTriggerChange?: (trigger: { query: string; start: number; end: number } | null) => void;
  onSlashOpenChange: (open: boolean) => void;
  onSlashActiveIndexChange: (index: number) => void;
  activeSlashIndex: number;
};

export const ChatInputBarTokenizedComposer = forwardRef<
  ChatInputBarTokenizedComposerHandle,
  ChatInputBarTokenizedComposerProps
>(function ChatInputBarTokenizedComposer(props, ref) {
  const editorRef = useRef<import('lexical').LexicalEditor | null>(null);
  const selectionRef = useRef<ChatComposerSelection | null>(null);
  const pendingSelectionRef = useRef<ChatComposerSelection | null>(null);
  const shouldFocusAfterSyncRef = useRef(false);
  const isComposingRef = useRef(false);
  const isApplyingExternalUpdateRef = useRef(false);
  const editorSignatureRef = useRef('');
  const lastPublishedSignatureRef = useRef('');

  const syncSlashState = (nodes: ChatComposerNode[], selection: ChatComposerSelection | null): void => {
    const trigger = resolveChatComposerSlashTrigger(nodes, selection);
    props.onSlashTriggerChange?.(trigger);
    props.onSlashQueryChange?.(trigger?.query ?? null);
    props.onSlashOpenChange(trigger !== null);
  };

  const readCurrentNodes = (): ChatComposerNode[] => {
    return props.nodes;
  };

  const readCurrentSelection = (): ChatComposerSelection | null => {
    if (selectionRef.current) {
      return selectionRef.current;
    }

    if (!editorRef.current) {
      return null;
    }

    const snapshot = readChatComposerSnapshotFromEditorState(editorRef.current.getEditorState());
    selectionRef.current = snapshot.selection;
    return snapshot.selection;
  };

  const publishSnapshot = (
    snapshot: { nodes: ChatComposerNode[]; selection: ChatComposerSelection | null },
    options?: { focusAfterSync?: boolean; forcePublish?: boolean },
  ): void => {
    selectionRef.current = snapshot.selection;
    pendingSelectionRef.current = snapshot.selection;

    if (options?.focusAfterSync) {
      shouldFocusAfterSyncRef.current = true;
    }

    const signature = getChatComposerNodesSignature(snapshot.nodes);
    syncSlashState(snapshot.nodes, snapshot.selection);

    if (options?.forcePublish || signature !== lastPublishedSignatureRef.current) {
      lastPublishedSignatureRef.current = signature;
      props.onNodesChange(snapshot.nodes);
    }
  };

  const focusComposer = (): void => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const targetSelection = selectionRef.current;
    editor.focus(() => {
      if (targetSelection) {
        syncLexicalSelectionFromChatComposerSelection(editor, targetSelection);
      }
    });
  };

  const readComposerSnapshot = (): { nodes: ChatComposerNode[]; selection: ChatComposerSelection | null } => ({
    nodes: readCurrentNodes(),
    selection: readCurrentSelection(),
  });

  useImperativeHandle(
    ref,
    () =>
      createLexicalComposerHandle({
        focusComposer,
        onSlashItemSelect: props.onSlashItemSelect,
        optionsReader: readComposerSnapshot,
        publishSnapshot,
      }),
    [props.onSlashItemSelect],
  );

  const initialConfig = useMemo(
    () => ({
      editable: !props.disabled,
      editorState: () => {
        writeChatComposerStateToLexicalRoot(props.nodes, null);
      },
      namespace: 'NextClawChatComposerLexical',
      nodes: [ChatComposerTokenNode],
      onError: (error: Error) => {
        throw error;
      },
      theme: {},
    }),
    [props.disabled, props.nodes],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="px-4 py-2.5">
        <div className="min-h-[60px]">
          <PlainTextPlugin
            contentEditable={
              <ContentEditable
                className="min-h-7 max-h-[188px] w-full overflow-y-auto whitespace-pre-wrap break-words bg-transparent py-0.5 text-sm leading-6 text-gray-800 outline-none"
                onBeforeInput={(event: FormEvent<HTMLDivElement>) => {
                  handleLexicalComposerBeforeInput({
                    disabled: props.disabled,
                    event,
                    isComposing: isComposingRef.current,
                    publishSnapshot,
                    snapshotReader: readComposerSnapshot,
                  });
                }}
                onCompositionEnd={(event) => {
                  isComposingRef.current = false;
                  const nativeEvent = event.nativeEvent as CompositionEvent;
                  handleLexicalComposerCompositionEnd({
                    data: typeof nativeEvent.data === 'string' ? nativeEvent.data : '',
                    fallbackSnapshot: () => {
                      const editor = editorRef.current;
                      return editor
                        ? readChatComposerSnapshotFromEditorState(editor.getEditorState())
                        : readComposerSnapshot();
                    },
                    publishSnapshot,
                    snapshotReader: readComposerSnapshot,
                  });
                }}
                onCompositionStart={() => {
                  isComposingRef.current = true;
                }}
                onPaste={(event: ClipboardEvent<HTMLDivElement>) => {
                  const files = Array.from(event.clipboardData.files ?? []);
                  if (files.length > 0 && props.onFilesAdd) {
                    event.preventDefault();
                    void props.onFilesAdd(files);
                  }
                }}
              />
            }
            placeholder={
              <div className="pointer-events-none absolute left-4 top-2.5 select-none text-sm leading-6 text-gray-400">
                {props.placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </div>
      <EditorRefPlugin editorRef={editorRef} />
      <ChatComposerBindingsPlugin
        disabled={props.disabled}
        editorRef={editorRef}
        editorSignatureRef={editorSignatureRef}
        isApplyingExternalUpdateRef={isApplyingExternalUpdateRef}
        isComposingRef={isComposingRef}
        lastPublishedSignatureRef={lastPublishedSignatureRef}
        nodes={props.nodes}
        onBlur={() => {
          props.onSlashQueryChange?.(null);
          props.onSlashOpenChange(false);
        }}
        onKeyDown={(event) => {
          const editor = editorRef.current;
          if (!editor) {
            return false;
          }

          const snapshot = readChatComposerSnapshotFromEditorState(editor.getEditorState());
          selectionRef.current = snapshot.selection;
          return handleLexicalComposerKeyboardCommand({
            actions: props.actions,
            activeSlashIndex: props.activeSlashIndex,
            nativeEvent: event,
            onSlashActiveIndexChange: props.onSlashActiveIndexChange,
            onSlashItemSelect: props.onSlashItemSelect,
            onSlashOpenChange: props.onSlashOpenChange,
            onSlashQueryChange: props.onSlashQueryChange,
            publishSnapshot,
            slashItems: props.slashItems,
            snapshot,
          });
        }}
        onNodesChange={props.onNodesChange}
        pendingSelectionRef={pendingSelectionRef}
        selectionRef={selectionRef}
        shouldFocusAfterSyncRef={shouldFocusAfterSyncRef}
        syncSlashState={syncSlashState}
      />
    </LexicalComposer>
  );
});

ChatInputBarTokenizedComposer.displayName = 'LexicalChatInputBarTokenizedComposer';
