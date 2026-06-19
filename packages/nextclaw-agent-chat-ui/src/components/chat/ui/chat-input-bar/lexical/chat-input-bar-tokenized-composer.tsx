import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  type ClipboardEvent,
  type FormEvent,
} from 'react';
import type { LexicalEditor } from 'lexical';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { EditorRefPlugin } from '@lexical/react/LexicalEditorRefPlugin';
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
  type ChatComposerEditorSnapshot,
  getChatComposerNodesSignature,
  readChatComposerSnapshotFromEditorState,
  syncLexicalEditorFromChatComposerState,
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

function getChatComposerDocumentLength(nodes: ChatComposerNode[]): number {
  return nodes.reduce((cursor, node) => cursor + (node.type === 'text' ? node.text.length : 1), 0);
}

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
  const editorRef = useRef<LexicalEditor | null>(null);
  const selectionRef = useRef<ChatComposerSelection | null>(null);
  const pendingSelectionRef = useRef<ChatComposerSelection | null>(null);
  const shouldFocusAfterSyncRef = useRef(false);
  const isComposingRef = useRef(false);
  const compositionStartSnapshotRef = useRef<ChatComposerEditorSnapshot | null>(null);
  const isApplyingExternalUpdateRef = useRef(false);
  const pendingInputSurfaceReasonRef = useRef<ChatInputSurfaceTriggerChangeReason | null>(null);
  const pendingOwnerSignatureRef = useRef<string | null>(null);
  const editorSignatureRef = useRef('');
  const lastPublishedSignatureRef = useRef('');

  const syncInputSurfaceSnapshot = useCallback(
    (
      nodes: ChatComposerNode[],
      selection: ChatComposerSelection | null,
      reason: ChatInputSurfaceTriggerChangeReason,
    ): void => {
      onInputSurfaceSnapshotChange?.(nodes, selection, reason);
    },
    [onInputSurfaceSnapshotChange],
  );

  const publishSnapshot = useCallback(
    (
      snapshot: { nodes: ChatComposerNode[]; selection: ChatComposerSelection | null },
      options?: {
        focusAfterSync?: boolean;
        forcePublish?: boolean;
        inputSurfaceReason?: ChatInputSurfaceTriggerChangeReason;
      },
    ): void => {
      selectionRef.current = snapshot.selection;
      pendingSelectionRef.current = snapshot.selection;

      if (options?.focusAfterSync) {
        shouldFocusAfterSyncRef.current = true;
      }

      const signature = getChatComposerNodesSignature(snapshot.nodes);
      const editor = editorRef.current;
      pendingOwnerSignatureRef.current = signature;
      if (editor) {
        isApplyingExternalUpdateRef.current = true;
        syncLexicalEditorFromChatComposerState(editor, snapshot.nodes, snapshot.selection);
        editorSignatureRef.current = signature;
        requestAnimationFrame(() => {
          isApplyingExternalUpdateRef.current = false;
        });
      }
      syncInputSurfaceSnapshot(snapshot.nodes, snapshot.selection, options?.inputSurfaceReason ?? { type: 'programmatic' });

      if (options?.forcePublish || signature !== lastPublishedSignatureRef.current) {
        lastPublishedSignatureRef.current = signature;
        onNodesChange(snapshot.nodes);
      }
    },
    [onNodesChange, syncInputSurfaceSnapshot],
  );

  const focusComposer = useCallback((): void => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    editor.getRootElement()?.focus({ preventScroll: true });
    const targetSelection = selectionRef.current;
    if (targetSelection) {
      syncLexicalSelectionFromChatComposerSelection(editor, targetSelection);
    }
    editor.focus();
  }, []);

  const focusComposerAtEnd = useCallback((nodes?: ChatComposerNode[]): void => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const targetNodes =
      nodes ?? readChatComposerSnapshotFromEditorState(editor.getEditorState()).nodes;
    const end = getChatComposerDocumentLength(targetNodes);
    const targetSelection = { start: end, end };
    selectionRef.current = targetSelection;
    pendingSelectionRef.current = targetSelection;
    editor.getRootElement()?.focus({ preventScroll: true });
    if (nodes) {
      isApplyingExternalUpdateRef.current = true;
      const signature = getChatComposerNodesSignature(nodes);
      syncLexicalEditorFromChatComposerState(editor, nodes, targetSelection);
      editorSignatureRef.current = signature;
      lastPublishedSignatureRef.current = signature;
      requestAnimationFrame(() => {
        isApplyingExternalUpdateRef.current = false;
      });
    } else {
      syncLexicalSelectionFromChatComposerSelection(editor, targetSelection);
    }
    editor.focus(() => {
      syncLexicalSelectionFromChatComposerSelection(editor, targetSelection);
    });
  }, []);

  const readComposerSnapshot = useCallback((): { nodes: ChatComposerNode[]; selection: ChatComposerSelection | null } => {
    const editor = editorRef.current;
    if (!editor) {
      return {
        nodes,
        selection: selectionRef.current,
      };
    }
    const snapshot = readChatComposerSnapshotFromEditorState(editor.getEditorState());
    selectionRef.current = snapshot.selection;
    return snapshot;
  }, [nodes]);

  const consumeInputSurfaceReason = useCallback((): ChatInputSurfaceTriggerChangeReason | null => {
    const reason = pendingInputSurfaceReasonRef.current;
    pendingInputSurfaceReasonRef.current = null;
    return reason;
  }, []);

  useImperativeHandle(
    ref,
    () =>
      createLexicalComposerHandle({
        focusComposer,
        focusComposerAtEnd,
        onInputSurfaceItemSelect,
        optionsReader: readComposerSnapshot,
        publishSnapshot,
      }),
    [
      focusComposer,
      focusComposerAtEnd,
      onInputSurfaceItemSelect,
      publishSnapshot,
      readComposerSnapshot,
    ],
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
                className="min-h-7 max-h-[188px] w-full overflow-y-auto whitespace-pre-wrap break-words bg-transparent py-0.5 text-sm leading-6 text-gray-800 outline-none"
                onBeforeInput={(event: FormEvent<HTMLDivElement>) => {
                  handleLexicalComposerBeforeInput({
                    disabled,
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
                    compositionStartSnapshot: compositionStartSnapshotRef.current,
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
                  compositionStartSnapshotRef.current = null;
                }}
                onCompositionStart={() => {
                  compositionStartSnapshotRef.current = readComposerSnapshot();
                  isComposingRef.current = true;
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
              <div className="pointer-events-none absolute left-3 top-2 select-none text-sm leading-6 text-gray-400 sm:left-4 sm:top-2.5">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </div>
      <EditorRefPlugin editorRef={editorRef} />
      <ChatComposerBindingsPlugin
        disabled={disabled}
        editorRef={editorRef}
        editorSignatureRef={editorSignatureRef}
        isApplyingExternalUpdateRef={isApplyingExternalUpdateRef}
        isComposingRef={isComposingRef}
        lastPublishedSignatureRef={lastPublishedSignatureRef}
        nodes={nodes}
        onBlur={() => {
          onInputSurfaceOpenChange?.(false);
        }}
        consumeInputSurfaceReason={consumeInputSurfaceReason}
        onKeyDown={(event) => {
          if (
            event.key.length === 1 &&
            !event.isComposing &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey
          ) {
            pendingInputSurfaceReasonRef.current = { type: 'insert-text', text: event.key };
          }
          const editor = editorRef.current;
          if (!editor) {
            return false;
          }

          const snapshot = readChatComposerSnapshotFromEditorState(editor.getEditorState());
          selectionRef.current = snapshot.selection;
          if (onInputSurfaceKeyDown?.(event)) {
            return true;
          }
          return handleLexicalComposerKeyboardCommand({
            actions,
            nativeEvent: event,
            publishSnapshot,
            snapshot,
          });
        }}
        onNodesChange={onNodesChange}
        pendingOwnerSignatureRef={pendingOwnerSignatureRef}
        pendingSelectionRef={pendingSelectionRef}
        selectionRef={selectionRef}
        shouldFocusAfterSyncRef={shouldFocusAfterSyncRef}
        syncInputSurfaceSnapshot={syncInputSurfaceSnapshot}
      />
    </LexicalComposer>
  );
});

ChatInputBarTokenizedComposer.displayName = 'LexicalChatInputBarTokenizedComposer';
