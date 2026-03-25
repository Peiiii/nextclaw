import type { ClipboardEvent, CompositionEvent, FormEvent, KeyboardEvent } from 'react';
import type {
  ChatComposerNode,
  ChatComposerSelection,
  ChatInputBarActionsProps,
  ChatSkillPickerOption,
  ChatSlashItem
} from '../../view-models/chat-ui.types';
import {
  readComposerDocumentStateFromDom,
  readComposerSelection,
  restoreComposerSelection
} from './chat-composer-dom.utils';
import type { ChatComposerController, ChatComposerControllerSnapshot } from './chat-composer-controller';
import { resolveChatComposerKeyboardAction } from './chat-composer-keyboard.utils';
import { ChatComposerSurfaceRenderer } from './chat-composer-surface-renderer';

const CHAT_INPUT_MAX_HEIGHT = 188;

type ComposerActions = Pick<ChatInputBarActionsProps, 'onSend' | 'onStop' | 'isSending' | 'canStopGeneration'>;

export class ChatComposerViewController {
  private readonly surfaceRenderer = new ChatComposerSurfaceRenderer();

  constructor(private readonly controller: ChatComposerController) {}

  sync = (nodes: ChatComposerNode[], selection: ChatComposerSelection | null): ChatComposerControllerSnapshot => {
    return this.controller.sync(nodes, selection);
  };

  syncSelectionFromRoot = (root: HTMLDivElement): ChatComposerControllerSnapshot => {
    return this.controller.setSelection(readComposerSelection(root, this.controller.getSnapshot().nodes));
  };

  restoreSelectionIfFocused = (
    root: HTMLDivElement | null,
    selection: ChatComposerSelection | null
  ): void => {
    if (!root || document.activeElement !== root) {
      return;
    }
    restoreComposerSelection(root, this.controller.getSnapshot().nodes, selection);
  };

  syncViewport = (root: HTMLDivElement | null): void => {
    if (!root) {
      return;
    }
    root.style.maxHeight = `${CHAT_INPUT_MAX_HEIGHT}px`;
    root.style.overflowY = root.scrollHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  };

  renderSurface = (params: {
    root: HTMLDivElement | null;
    snapshot: ChatComposerControllerSnapshot;
    selectedRange: ChatComposerSelection | null;
  }): void => {
    this.surfaceRenderer.render(params.root, {
      nodes: params.snapshot.nodes,
      selectedRange: params.selectedRange,
      nodeStartMap: params.snapshot.nodeStartMap
    });
  };

  insertSlashItem = (
    item: ChatSlashItem,
    commitSnapshot: (snapshot: ChatComposerControllerSnapshot) => void
  ): void => {
    if (!item.value) {
      return;
    }
    commitSnapshot(this.controller.insertSkillToken(item.value, item.title));
  };

  syncSelectedSkills = (
    nextKeys: string[],
    options: ChatSkillPickerOption[],
    commitSnapshot: (snapshot: ChatComposerControllerSnapshot) => void
  ): void => {
    commitSnapshot(this.controller.syncSelectedSkills(nextKeys, options));
  };

  handleBeforeInput = (params: {
    event: FormEvent<HTMLDivElement>;
    disabled: boolean;
    isComposing: boolean;
    commitSnapshot: (snapshot: ChatComposerControllerSnapshot) => void;
  }): void => {
    const { event, disabled, isComposing, commitSnapshot } = params;
    const nativeEvent = event.nativeEvent as InputEvent;
    if (disabled || isComposing || nativeEvent.isComposing) {
      return;
    }

    const shouldInsertText =
      nativeEvent.inputType === 'insertText' ||
      nativeEvent.inputType === 'insertReplacementText';

    if (!shouldInsertText || !nativeEvent.data) {
      return;
    }

    event.preventDefault();
    commitSnapshot(this.controller.insertText(nativeEvent.data));
  };

  handleInput = (params: {
    event: FormEvent<HTMLDivElement>;
    isComposing: boolean;
    commitSnapshot: (snapshot: ChatComposerControllerSnapshot) => void;
  }): void => {
    const { event, isComposing, commitSnapshot } = params;
    const nativeEvent = event.nativeEvent as InputEvent;
    if (isComposing || nativeEvent.isComposing) {
      return;
    }
    const root = event.currentTarget;
    const nextDocumentState = readComposerDocumentStateFromDom(root);
    commitSnapshot(this.controller.replaceDocument(nextDocumentState.nodes, nextDocumentState.selection));
  };

  handleCompositionEnd = (params: {
    event: CompositionEvent<HTMLDivElement>;
    commitSnapshot: (snapshot: ChatComposerControllerSnapshot) => void;
  }): void => {
    const { event, commitSnapshot } = params;
    const root = event.currentTarget;
    const nextDocumentState = readComposerDocumentStateFromDom(root);
    commitSnapshot(this.controller.replaceDocument(nextDocumentState.nodes, nextDocumentState.selection));
  };

  handleKeyDown = (params: {
    event: KeyboardEvent<HTMLDivElement>;
    slashItems: ChatSlashItem[];
    activeSlashIndex: number;
    activeSlashItem: ChatSlashItem | null;
    actions: ComposerActions;
    commitSnapshot: (snapshot: ChatComposerControllerSnapshot) => void;
    insertSkillToken: (tokenKey: string, label: string) => void;
    onSlashActiveIndexChange: (index: number) => void;
    onSlashQueryChange?: (query: string | null) => void;
    onSlashOpenChange: (open: boolean) => void;
  }): void => {
    const {
      event,
      slashItems,
      activeSlashIndex,
      activeSlashItem,
      actions,
      commitSnapshot,
      insertSkillToken,
      onSlashActiveIndexChange,
      onSlashQueryChange,
      onSlashOpenChange
    } = params;

    const currentSnapshot = this.controller.getSnapshot();
    const action = resolveChatComposerKeyboardAction({
      key: event.key,
      shiftKey: event.shiftKey,
      isComposing: event.nativeEvent.isComposing,
      isSlashMenuOpen: currentSnapshot.slashTrigger !== null,
      slashItemCount: slashItems.length,
      activeSlashIndex,
      isSending: actions.isSending,
      canStopGeneration: actions.canStopGeneration
    });

    if (action.type === 'noop') {
      return;
    }

    event.preventDefault();

    if (action.type === 'move-slash-index') {
      onSlashActiveIndexChange(action.index);
      return;
    }
    if (action.type === 'insert-active-slash-item') {
      if (activeSlashItem) {
        insertSkillToken(activeSlashItem.value ?? activeSlashItem.key, activeSlashItem.title);
      }
      return;
    }
    if (action.type === 'close-slash') {
      onSlashQueryChange?.(null);
      onSlashOpenChange(false);
      return;
    }
    if (action.type === 'stop-generation') {
      void actions.onStop();
      return;
    }
    if (action.type === 'insert-line-break') {
      commitSnapshot(this.controller.insertText('\n'));
      return;
    }
    if (action.type === 'send-message') {
      void actions.onSend();
      return;
    }
    if (action.type === 'delete-content') {
      commitSnapshot(this.controller.deleteContent(action.direction));
    }
  };

  handlePaste = (params: {
    event: ClipboardEvent<HTMLDivElement>;
    onFilesAdd?: (files: File[]) => Promise<void> | void;
    commitSnapshot: (snapshot: ChatComposerControllerSnapshot) => void;
  }): void => {
    const { event, onFilesAdd, commitSnapshot } = params;
    const files = Array.from(event.clipboardData.files ?? []);
    if (files.length > 0 && onFilesAdd) {
      event.preventDefault();
      void onFilesAdd(files);
      return;
    }
    const text = event.clipboardData.getData('text/plain');
    if (!text) {
      return;
    }
    event.preventDefault();
    commitSnapshot(this.controller.insertText(text));
  };

  handleBlur = (params: {
    clearSelectedRange: () => void;
    onSlashQueryChange?: (query: string | null) => void;
    onSlashOpenChange: (open: boolean) => void;
  }): void => {
    const { clearSelectedRange, onSlashQueryChange, onSlashOpenChange } = params;
    clearSelectedRange();
    onSlashQueryChange?.(null);
    onSlashOpenChange(false);
  };
}
