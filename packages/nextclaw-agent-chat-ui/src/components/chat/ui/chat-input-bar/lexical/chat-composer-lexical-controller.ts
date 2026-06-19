import type { FormEvent } from 'react';
import type {
  ChatComposerNode,
  ChatComposerSelection,
  ChatInputBarActionsProps,
  ChatInputSurfaceTriggerChangeReason,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import {
  deleteChatComposerContent,
  replaceChatComposerSelectionWithText,
  type ChatComposerEditorSnapshot,
} from './chat-composer-lexical-adapter';

type ComposerActions = Pick<
  ChatInputBarActionsProps,
  'onSend' | 'onStop' | 'isSending' | 'canStopGeneration'
>;

type ChatComposerPublishOptions = {
  focusAfterSync?: boolean;
  forcePublish?: boolean;
  inputSurfaceReason?: ChatInputSurfaceTriggerChangeReason;
};

type ChatComposerKeyboardAction =
  | { type: 'consume' }
  | { type: 'delete-content'; direction: 'backward' | 'forward' }
  | { type: 'insert-line-break' }
  | { type: 'noop' }
  | { type: 'send-message' }
  | { type: 'stop-generation' };

export function resolveLexicalComposerKeyboardAction(params: {
  canStopGeneration: boolean;
  isComposing: boolean;
  isSending: boolean;
  key: string;
  shiftKey: boolean;
}): ChatComposerKeyboardAction {
  const {
    canStopGeneration,
    isComposing,
    isSending,
    key,
    shiftKey,
  } = params;

  if (key === 'Enter' && !shiftKey && isSending) {
    return { type: 'consume' };
  }

  if (key === 'Escape') {
    if (isSending && canStopGeneration) {
      return { type: 'stop-generation' };
    }
    return { type: 'noop' };
  }

  if (key === 'Enter' && shiftKey) {
    return { type: 'insert-line-break' };
  }

  if (key === 'Enter') {
    return { type: 'send-message' };
  }

  if (!isComposing && (key === 'Backspace' || key === 'Delete')) {
    return {
      type: 'delete-content',
      direction: key === 'Backspace' ? 'backward' : 'forward',
    };
  }

  return { type: 'noop' };
}

function getChatComposerContentSignature(nodes: ChatComposerNode[]): string {
  return JSON.stringify(
    nodes.map((node) =>
      node.type === 'text'
        ? { text: node.text, type: node.type }
        : {
            label: node.label,
            tokenKey: node.tokenKey,
            tokenKind: node.tokenKind,
            type: node.type,
          },
    ),
  );
}

export function handleLexicalComposerBeforeInput(params: {
  disabled: boolean;
  event: FormEvent<HTMLDivElement>;
  isComposing: boolean;
  publishSnapshot: (snapshot: ChatComposerEditorSnapshot, options?: ChatComposerPublishOptions) => void;
  snapshotReader: () => {
    nodes: ChatComposerNode[];
    selection: ChatComposerSelection | null;
  };
}): void {
  const { disabled, event, isComposing, publishSnapshot, snapshotReader } = params;
  const nativeEvent = event.nativeEvent as InputEvent;
  const shouldInsertText =
    nativeEvent.inputType === 'insertText' ||
    nativeEvent.inputType === 'insertReplacementText';

  if (
    disabled ||
    isComposing ||
    nativeEvent.isComposing ||
    !shouldInsertText ||
    !nativeEvent.data
  ) {
    return;
  }

  event.preventDefault();
  publishSnapshot(
    replaceChatComposerSelectionWithText({
      nodes: snapshotReader().nodes,
      selection: snapshotReader().selection,
      text: nativeEvent.data,
    }),
    { inputSurfaceReason: { type: 'insert-text', text: nativeEvent.data } },
  );
}

export function handleLexicalComposerCompositionEnd(params: {
  compositionStartSnapshot?: ChatComposerEditorSnapshot | null;
  data: string;
  fallbackSnapshot: () => ChatComposerEditorSnapshot;
  publishSnapshot: (
    snapshot: ChatComposerEditorSnapshot,
    options?: ChatComposerPublishOptions,
  ) => void;
  snapshotReader: () => {
    nodes: ChatComposerNode[];
    selection: ChatComposerSelection | null;
  };
}): void {
  const { compositionStartSnapshot, data, fallbackSnapshot, publishSnapshot, snapshotReader } = params;
  const currentSnapshot = snapshotReader();
  const editorSnapshot = fallbackSnapshot();
  const baseSnapshot = compositionStartSnapshot ?? currentSnapshot;
  const shouldUseEditorSnapshot =
    getChatComposerContentSignature(editorSnapshot.nodes) !==
    getChatComposerContentSignature(baseSnapshot.nodes);
  const snapshot = shouldUseEditorSnapshot
    ? editorSnapshot
    : data.length > 0
      ? replaceChatComposerSelectionWithText({
          nodes: baseSnapshot.nodes,
          selection: baseSnapshot.selection,
          text: data,
        })
      : editorSnapshot;
  publishSnapshot(snapshot, {
    forcePublish: true,
    inputSurfaceReason: { type: 'insert-text', text: data },
  });
}

export function handleLexicalComposerKeyboardCommand(params: {
  actions: ComposerActions;
  publishSnapshot: (
    snapshot: ChatComposerEditorSnapshot,
    options?: ChatComposerPublishOptions,
  ) => void;
  snapshot: ChatComposerEditorSnapshot;
  nativeEvent: KeyboardEvent;
}): boolean {
  const {
    actions,
    nativeEvent,
    publishSnapshot,
    snapshot,
  } = params;
  const action = resolveLexicalComposerKeyboardAction({
    canStopGeneration: actions.canStopGeneration,
    isComposing: nativeEvent.isComposing,
    isSending: actions.isSending,
    key: nativeEvent.key,
    shiftKey: nativeEvent.shiftKey,
  });

  if (action.type !== 'noop') {
    nativeEvent.preventDefault();
  }

  switch (action.type) {
    case 'consume':
      return true;
    case 'stop-generation':
      void actions.onStop();
      return true;
    case 'insert-line-break':
      publishSnapshot(
        replaceChatComposerSelectionWithText({
          nodes: snapshot.nodes,
          selection: snapshot.selection,
          text: '\n',
        }),
        { inputSurfaceReason: { type: 'insert-text', text: '\n' } },
      );
      return true;
    case 'send-message':
      void actions.onSend();
      return true;
    case 'delete-content':
      publishSnapshot(
        deleteChatComposerContent({
          direction: action.direction,
          nodes: snapshot.nodes,
          selection: snapshot.selection,
        }),
        { inputSurfaceReason: { type: 'delete-content' } },
      );
      return true;
    case 'noop':
      return false;
  }
}
