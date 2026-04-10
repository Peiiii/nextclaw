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
import type { ChatComposerNode, ChatComposerSelection } from '../../../view-models/chat-ui.types';
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
  onKeyDown: (event: KeyboardEvent) => boolean;
  onNodesChange: (nodes: ChatComposerNode[]) => void;
  pendingSelectionRef: MutableRefObject<ChatComposerSelection | null>;
  selectionRef: MutableRefObject<ChatComposerSelection | null>;
  shouldFocusAfterSyncRef: MutableRefObject<boolean>;
  syncSlashState: (nodes: ChatComposerNode[], selection: ChatComposerSelection | null) => void;
};

export function ChatComposerBindingsPlugin(
  props: ChatComposerBindingsPluginProps,
): null {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    props.editorRef.current = editor;
    return () => {
      if (props.editorRef.current === editor) {
        props.editorRef.current = null;
      }
    };
  }, [editor, props.editorRef]);

  useLayoutEffect(() => {
    editor.setEditable(!props.disabled);
  }, [editor, props.disabled]);

  useLayoutEffect(() => {
    const nextSignature = getChatComposerNodesSignature(props.nodes);
    const pendingSelection = props.pendingSelectionRef.current;
    const shouldSyncDocument = nextSignature !== props.editorSignatureRef.current;

    if (!shouldSyncDocument && !pendingSelection) {
      return;
    }

    props.isApplyingExternalUpdateRef.current = true;

    if (shouldSyncDocument) {
      syncLexicalEditorFromChatComposerState(editor, props.nodes, pendingSelection);
      props.editorSignatureRef.current = nextSignature;
      props.lastPublishedSignatureRef.current = nextSignature;
    } else if (pendingSelection) {
      syncLexicalSelectionFromChatComposerSelection(editor, pendingSelection);
    }

    if (pendingSelection) {
      props.selectionRef.current = pendingSelection;
      props.pendingSelectionRef.current = null;
    }

    if (props.shouldFocusAfterSyncRef.current) {
      props.shouldFocusAfterSyncRef.current = false;
      const targetSelection = props.selectionRef.current;
      editor.focus(() => {
        if (targetSelection) {
          syncLexicalSelectionFromChatComposerSelection(editor, targetSelection);
        }
      });
    }

    requestAnimationFrame(() => {
      props.isApplyingExternalUpdateRef.current = false;
    });
  }, [
    editor,
    props.editorSignatureRef,
    props.isApplyingExternalUpdateRef,
    props.lastPublishedSignatureRef,
    props.nodes,
    props.pendingSelectionRef,
    props.selectionRef,
    props.shouldFocusAfterSyncRef,
  ]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        const snapshot = readChatComposerSnapshotFromEditorState(editorState);
        const signature = getChatComposerNodesSignature(snapshot.nodes);

        props.selectionRef.current = snapshot.selection;
        props.editorSignatureRef.current = signature;
        props.syncSlashState(snapshot.nodes, snapshot.selection);

        if (props.isApplyingExternalUpdateRef.current || props.isComposingRef.current) {
          return;
        }

        if (signature === props.lastPublishedSignatureRef.current) {
          return;
        }

        props.lastPublishedSignatureRef.current = signature;
        props.onNodesChange(snapshot.nodes);
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          const snapshot = readChatComposerSnapshotFromEditorState(editor.getEditorState());
          props.selectionRef.current = snapshot.selection;
          if (!props.isComposingRef.current) {
            props.syncSlashState(snapshot.nodes, snapshot.selection);
          }
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          props.onBlur();
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => props.onKeyDown(event),
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [
    editor,
    props.editorSignatureRef,
    props.isApplyingExternalUpdateRef,
    props.isComposingRef,
    props.lastPublishedSignatureRef,
    props.onBlur,
    props.onKeyDown,
    props.onNodesChange,
    props.selectionRef,
    props.syncSlashState,
  ]);

  return null;
}
