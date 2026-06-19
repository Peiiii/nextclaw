import { useEffect, useLayoutEffect, type MutableRefObject } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  BLUR_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
  SELECTION_CHANGE_COMMAND,
  mergeRegister,
  type LexicalEditor,
} from 'lexical';
import type {
  ChatComposerNode,
  ChatComposerSelection,
  ChatInputSurfaceTriggerChangeReason,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import {
  getChatComposerNodesSignature,
  readChatComposerSnapshotFromEditorState,
  syncLexicalEditorFromChatComposerState,
  syncLexicalSelectionFromChatComposerSelection,
} from './chat-composer-lexical-adapter';

type ChatComposerBindingsPluginProps = {
  disabled: boolean;
  editorRef: MutableRefObject<LexicalEditor | null>;
  editorSignatureRef: MutableRefObject<string>;
  isApplyingExternalUpdateRef: MutableRefObject<boolean>;
  isComposingRef: MutableRefObject<boolean>;
  lastPublishedSignatureRef: MutableRefObject<string>;
  nodes: ChatComposerNode[];
  onBlur: () => void;
  consumeInputSurfaceReason: () => ChatInputSurfaceTriggerChangeReason | null;
  onKeyDown: (event: KeyboardEvent) => boolean;
  onNodesChange: (nodes: ChatComposerNode[]) => void;
  pendingSelectionRef: MutableRefObject<ChatComposerSelection | null>;
  selectionRef: MutableRefObject<ChatComposerSelection | null>;
  shouldFocusAfterSyncRef: MutableRefObject<boolean>;
  syncInputSurfaceSnapshot: (
    nodes: ChatComposerNode[],
    selection: ChatComposerSelection | null,
    reason: ChatInputSurfaceTriggerChangeReason,
  ) => void;
};

export function ChatComposerBindingsPlugin(
  {
    disabled,
    editorRef,
    editorSignatureRef,
    isApplyingExternalUpdateRef,
    isComposingRef,
    lastPublishedSignatureRef,
    nodes,
    onBlur,
    consumeInputSurfaceReason,
    onKeyDown,
    onNodesChange,
    pendingSelectionRef,
    selectionRef,
    shouldFocusAfterSyncRef,
    syncInputSurfaceSnapshot,
  }: ChatComposerBindingsPluginProps,
): null {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editorRef.current = editor;
    return () => {
      if (editorRef.current === editor) {
        editorRef.current = null;
      }
    };
  }, [editor, editorRef]);

  useLayoutEffect(() => {
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useLayoutEffect(() => {
    const nextSignature = getChatComposerNodesSignature(nodes);
    const pendingSelection = pendingSelectionRef.current;
    const shouldSyncDocument = nextSignature !== editorSignatureRef.current;

    if (!shouldSyncDocument && !pendingSelection) {
      return;
    }

    isApplyingExternalUpdateRef.current = true;

    if (shouldSyncDocument) {
      syncLexicalEditorFromChatComposerState(editor, nodes, pendingSelection);
      editorSignatureRef.current = nextSignature;
      lastPublishedSignatureRef.current = nextSignature;
    } else if (pendingSelection) {
      syncLexicalSelectionFromChatComposerSelection(editor, pendingSelection);
    }

    if (pendingSelection) {
      selectionRef.current = pendingSelection;
      pendingSelectionRef.current = null;
    }

    if (shouldFocusAfterSyncRef.current) {
      shouldFocusAfterSyncRef.current = false;
      const targetSelection = selectionRef.current;
      editor.focus(() => {
        if (targetSelection) {
          syncLexicalSelectionFromChatComposerSelection(editor, targetSelection);
        }
      });
    }

    requestAnimationFrame(() => {
      isApplyingExternalUpdateRef.current = false;
    });
  }, [
    editor,
    editorSignatureRef,
    isApplyingExternalUpdateRef,
    lastPublishedSignatureRef,
    nodes,
    pendingSelectionRef,
    selectionRef,
    shouldFocusAfterSyncRef,
  ]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        const snapshot = readChatComposerSnapshotFromEditorState(editorState);
        const signature = getChatComposerNodesSignature(snapshot.nodes);

        selectionRef.current = snapshot.selection;
        editorSignatureRef.current = signature;

        if (isApplyingExternalUpdateRef.current || isComposingRef.current) {
          return;
        }

        syncInputSurfaceSnapshot(snapshot.nodes, snapshot.selection, consumeInputSurfaceReason() ?? { type: 'sync' });

        if (signature === lastPublishedSignatureRef.current) {
          return;
        }

        lastPublishedSignatureRef.current = signature;
        onNodesChange(snapshot.nodes);
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          const snapshot = readChatComposerSnapshotFromEditorState(editor.getEditorState());
          selectionRef.current = snapshot.selection;
          if (!isComposingRef.current) {
            syncInputSurfaceSnapshot(snapshot.nodes, snapshot.selection, { type: 'selection' });
          }
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          onBlur();
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => onKeyDown(event),
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [
    editor,
    editorSignatureRef,
    isApplyingExternalUpdateRef,
    isComposingRef,
    lastPublishedSignatureRef,
    onBlur,
    consumeInputSurfaceReason,
    onKeyDown,
    onNodesChange,
    selectionRef,
    syncInputSurfaceSnapshot,
  ]);

  return null;
}
