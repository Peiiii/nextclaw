import type { FormEvent } from 'react';
import type {
  ChatComposerNode,
  ChatComposerSelection,
  ChatInputBarActionsProps,
  ChatSkillPickerOption,
  ChatSlashItem,
} from '../../../view-models/chat-ui.types';
import { resolveChatComposerSlashTrigger } from '../chat-composer.utils';
import {
  deleteChatComposerContent,
  insertFileTokenIntoChatComposer,
  insertSkillTokenIntoChatComposer,
  replaceChatComposerSelectionWithText,
  syncSelectedSkillsIntoChatComposer,
  type ChatComposerEditorSnapshot,
} from './chat-composer-lexical-adapter';
import type { ChatInputBarTokenizedComposerHandle } from './chat-input-bar-tokenized-composer';

type ComposerActions = Pick<
  ChatInputBarActionsProps,
  'onSend' | 'onStop' | 'isSending' | 'canStopGeneration'
>;

type ChatComposerKeyboardAction =
  | { type: 'close-slash' }
  | { type: 'consume' }
  | { type: 'delete-content'; direction: 'backward' | 'forward' }
  | { type: 'insert-active-slash-item' }
  | { type: 'insert-line-break' }
  | { type: 'move-slash-index'; index: number }
  | { type: 'noop' }
  | { type: 'send-message' }
  | { type: 'stop-generation' };

export function resolveLexicalComposerKeyboardAction(params: {
  activeSlashIndex: number;
  canStopGeneration: boolean;
  isComposing: boolean;
  isSending: boolean;
  isSlashMenuOpen: boolean;
  key: string;
  shiftKey: boolean;
  slashItemCount: number;
}): ChatComposerKeyboardAction {
  const {
    activeSlashIndex,
    canStopGeneration,
    isComposing,
    isSending,
    isSlashMenuOpen,
    key,
    shiftKey,
    slashItemCount,
  } = params;

  if (key === 'Enter' && !shiftKey && isSending) {
    return { type: 'consume' };
  }

  if (isSlashMenuOpen && slashItemCount > 0) {
    if (key === 'ArrowDown') {
      return {
        type: 'move-slash-index',
        index: (activeSlashIndex + 1) % slashItemCount,
      };
    }
    if (key === 'ArrowUp') {
      return {
        type: 'move-slash-index',
        index: (activeSlashIndex - 1 + slashItemCount) % slashItemCount,
      };
    }
    if ((key === 'Enter' && !shiftKey) || key === 'Tab') {
      return { type: 'insert-active-slash-item' };
    }
  }

  if (key === 'Escape') {
    if (isSlashMenuOpen) {
      return { type: 'close-slash' };
    }
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

type LexicalComposerHandleOwnerParams = {
  focusComposer: () => void;
  onSlashItemSelect?: (item: ChatSlashItem) => void;
  optionsReader: () => {
    nodes: ChatComposerNode[];
    selection: ChatComposerSelection | null;
  };
  publishSnapshot: (
    snapshot: ChatComposerEditorSnapshot,
    options?: { focusAfterSync?: boolean; forcePublish?: boolean },
  ) => void;
};

class LexicalComposerHandleOwner implements ChatInputBarTokenizedComposerHandle {
  constructor(private readonly params: LexicalComposerHandleOwnerParams) {}

  insertSlashItem = (item: ChatSlashItem): void => {
    if (!item.value) {
      return;
    }

    this.params.onSlashItemSelect?.(item);
    this.params.publishSnapshot(
      insertSkillTokenIntoChatComposer({
        label: item.title,
        nodes: this.params.optionsReader().nodes,
        selection: this.params.optionsReader().selection,
        tokenKey: item.value,
      }),
      { focusAfterSync: true },
    );
  };

  insertFileToken = (tokenKey: string, label: string): void => {
    this.params.publishSnapshot(
      insertFileTokenIntoChatComposer({
        label,
        nodes: this.params.optionsReader().nodes,
        selection: this.params.optionsReader().selection,
        tokenKey,
      }),
      { focusAfterSync: true },
    );
  };

  insertFileTokens = (tokens: Array<{ tokenKey: string; label: string }>): void => {
    let nextNodes = this.params.optionsReader().nodes;
    let nextSelection = this.params.optionsReader().selection;

    for (const token of tokens) {
      const snapshot = insertFileTokenIntoChatComposer({
        label: token.label,
        nodes: nextNodes,
        selection: nextSelection,
        tokenKey: token.tokenKey,
      });
      nextNodes = snapshot.nodes;
      nextSelection = snapshot.selection;
    }

    this.params.publishSnapshot(
      {
        nodes: nextNodes,
        selection: nextSelection,
      },
      { focusAfterSync: true },
    );
  };

  focusComposer = (): void => {
    this.params.focusComposer();
  };

  syncSelectedSkills = (nextKeys: string[], options: ChatSkillPickerOption[]): void => {
    this.params.publishSnapshot(
      syncSelectedSkillsIntoChatComposer({
        nextKeys,
        nodes: this.params.optionsReader().nodes,
        options,
        selection: this.params.optionsReader().selection,
      }),
      { focusAfterSync: true },
    );
  };
}

export function createLexicalComposerHandle(
  params: LexicalComposerHandleOwnerParams,
): ChatInputBarTokenizedComposerHandle {
  return new LexicalComposerHandleOwner(params);
}

export function handleLexicalComposerBeforeInput(params: {
  disabled: boolean;
  event: FormEvent<HTMLDivElement>;
  isComposing: boolean;
  publishSnapshot: (snapshot: ChatComposerEditorSnapshot) => void;
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
  );
}

export function handleLexicalComposerCompositionEnd(params: {
  data: string;
  fallbackSnapshot: () => ChatComposerEditorSnapshot;
  publishSnapshot: (
    snapshot: ChatComposerEditorSnapshot,
    options?: { focusAfterSync?: boolean; forcePublish?: boolean },
  ) => void;
  snapshotReader: () => {
    nodes: ChatComposerNode[];
    selection: ChatComposerSelection | null;
  };
}): void {
  const { data, fallbackSnapshot, publishSnapshot, snapshotReader } = params;
  const snapshot =
    data.length > 0
      ? replaceChatComposerSelectionWithText({
          nodes: snapshotReader().nodes,
          selection: snapshotReader().selection,
          text: data,
        })
      : fallbackSnapshot();
  publishSnapshot(snapshot, { forcePublish: true });
}

export function handleLexicalComposerKeyboardCommand(params: {
  actions: ComposerActions;
  activeSlashIndex: number;
  onSlashActiveIndexChange: (index: number) => void;
  onSlashItemSelect?: (item: ChatSlashItem) => void;
  onSlashOpenChange: (open: boolean) => void;
  onSlashQueryChange?: (query: string | null) => void;
  publishSnapshot: (
    snapshot: ChatComposerEditorSnapshot,
    options?: { focusAfterSync?: boolean; forcePublish?: boolean },
  ) => void;
  slashItems: ChatSlashItem[];
  snapshot: ChatComposerEditorSnapshot;
  nativeEvent: KeyboardEvent;
}): boolean {
  const {
    actions,
    activeSlashIndex,
    nativeEvent,
    onSlashActiveIndexChange,
    onSlashItemSelect,
    onSlashOpenChange,
    onSlashQueryChange,
    publishSnapshot,
    slashItems,
    snapshot,
  } = params;
  const action = resolveLexicalComposerKeyboardAction({
    activeSlashIndex,
    canStopGeneration: actions.canStopGeneration,
    isComposing: nativeEvent.isComposing,
    isSending: actions.isSending,
    isSlashMenuOpen: resolveChatComposerSlashTrigger(snapshot.nodes, snapshot.selection) !== null,
    key: nativeEvent.key,
    shiftKey: nativeEvent.shiftKey,
    slashItemCount: slashItems.length,
  });
  const activeSlashItem = slashItems[activeSlashIndex] ?? null;

  if (action.type !== 'noop') {
    nativeEvent.preventDefault();
  }

  switch (action.type) {
    case 'move-slash-index':
      onSlashActiveIndexChange(action.index);
      return true;
    case 'insert-active-slash-item':
      if (!activeSlashItem) {
        return true;
      }
      onSlashItemSelect?.(activeSlashItem);
      publishSnapshot(
        insertSkillTokenIntoChatComposer({
          label: activeSlashItem.title,
          nodes: snapshot.nodes,
          selection: snapshot.selection,
          tokenKey: activeSlashItem.value ?? activeSlashItem.key,
        }),
        { focusAfterSync: true },
      );
      return true;
    case 'close-slash':
      onSlashQueryChange?.(null);
      onSlashOpenChange(false);
      return true;
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
      );
      return true;
    case 'noop':
      return false;
  }
}
