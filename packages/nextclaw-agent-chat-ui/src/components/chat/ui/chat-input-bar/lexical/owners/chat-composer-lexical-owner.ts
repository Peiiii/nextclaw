import type { FormEvent } from 'react';
import type { EditorState, LexicalEditor } from 'lexical';
import {
  BLUR_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
  SELECTION_CHANGE_COMMAND,
  mergeRegister,
} from 'lexical';
import type {
  ChatComposerNode,
  ChatComposerSelection,
  ChatInputBarActionsProps,
  ChatInputSurfaceItem,
  ChatInputSurfaceTriggerChangeReason,
  ChatInputSurfaceTriggerSpec,
  ChatSkillPickerOption,
  ChatSlashItem,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import {
  CHAT_INPUT_SURFACE_SLASH_TRIGGER_SPEC,
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';
import {
  type ChatComposerEditorSnapshot,
  getChatComposerNodesSignature,
  insertFileTokenIntoChatComposer,
  insertInputSurfaceItemIntoChatComposer,
  readChatComposerSnapshotFromEditorState,
  syncLexicalEditorFromChatComposerState,
  syncLexicalSelectionFromChatComposerSelection,
  syncSelectedSkillsIntoChatComposer,
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-adapter';
import {
  handleLexicalComposerBeforeInput,
  handleLexicalComposerKeyboardCommand,
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-controller';

type ComposerActions = Pick<ChatInputBarActionsProps, 'onSend' | 'onStop' | 'isSending' | 'canStopGeneration'>;

export type ChatComposerLexicalOwnerCallbacks = {
  onInputSurfaceItemSelect?: (item: ChatInputSurfaceItem) => void;
  onInputSurfaceKeyDown?: (event: KeyboardEvent) => boolean;
  onInputSurfaceOpenChange?: (open: boolean) => void;
  onInputSurfaceSnapshotChange?: (
    nodes: ChatComposerNode[],
    selection: ChatComposerSelection | null,
    reason: ChatInputSurfaceTriggerChangeReason,
  ) => void;
  onNodesChange: (nodes: ChatComposerNode[]) => void;
};

type ComposerRuntime = {
  actions: ComposerActions;
  callbacks: ChatComposerLexicalOwnerCallbacks;
  fallbackNodes: ChatComposerNode[];
};

type PublishOptions = {
  focusAfterSync?: boolean;
  inputSurfaceReason?: ChatInputSurfaceTriggerChangeReason;
};

function createMutableRef<T>(value: T): { current: T } {
  return { current: value };
}

function getChatComposerDocumentLength(nodes: ChatComposerNode[]): number {
  return nodes.reduce((cursor, node) => cursor + (node.type === 'text' ? node.text.length : 1), 0);
}

export class ChatComposerLexicalOwner {
  readonly isApplyingExternalUpdateRef = createMutableRef(false);
  readonly pendingOwnerSignatureRef = createMutableRef<string | null>(null);
  readonly pendingSelectionRef = createMutableRef<ChatComposerSelection | null>(null);
  readonly selectionRef = createMutableRef<ChatComposerSelection | null>(null);
  readonly shouldFocusAfterSyncRef = createMutableRef(false);

  private readonly editorSignatureRef = createMutableRef('');
  private readonly lastPublishedSignatureRef = createMutableRef('');
  private readonly pendingInputSurfaceReasonRef = createMutableRef<ChatInputSurfaceTriggerChangeReason | null>(null);
  private editor: LexicalEditor | null = null;
  private runtime: ComposerRuntime | null = null;

  configureRuntime = (runtime: ComposerRuntime): void => {
    this.runtime = runtime;
  };

  bindEditor = (editor: LexicalEditor): (() => void) => {
    this.editor = editor;
    return () => {
      if (this.editor === editor) {
        this.editor = null;
      }
    };
  };

  registerEditorListeners = (editor: LexicalEditor): (() => void) => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        const runtime = this.getRuntime();
        this.handleEditorUpdate(editorState, runtime.callbacks);
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          const runtime = this.getRuntime();
          this.handleSelectionChange(editor, runtime.callbacks);
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          const runtime = this.getRuntime();
          runtime.callbacks.onInputSurfaceOpenChange?.(false);
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          const runtime = this.getRuntime();
          return this.handleKeyDown({
            actions: runtime.actions,
            callbacks: runtime.callbacks,
            event,
            fallbackNodes: runtime.fallbackNodes,
          });
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  };

  syncExternalState = (editor: LexicalEditor, nodes: ChatComposerNode[]): void => {
    if (editor.isComposing()) {
      return;
    }
    const nextSignature = getChatComposerNodesSignature(nodes);
    const pendingSelection = this.pendingSelectionRef.current;
    const pendingOwnerSignature = this.pendingOwnerSignatureRef.current;

    if (pendingOwnerSignature) {
      if (nextSignature === pendingOwnerSignature) {
        this.pendingOwnerSignatureRef.current = null;
      } else if (nextSignature !== this.editorSignatureRef.current) {
        return;
      }
    }

    const shouldSyncDocument = nextSignature !== this.editorSignatureRef.current;

    if (!shouldSyncDocument && !pendingSelection) {
      return;
    }

    this.startApplyingExternalUpdate();
    const preserveDomSelection = editor.getRootElement() !== document.activeElement;

    if (shouldSyncDocument) {
      syncLexicalEditorFromChatComposerState(editor, nodes, pendingSelection, preserveDomSelection);
      this.editorSignatureRef.current = nextSignature;
      this.lastPublishedSignatureRef.current = nextSignature;
    } else if (pendingSelection) {
      syncLexicalSelectionFromChatComposerSelection(editor, pendingSelection, preserveDomSelection);
    }

    if (pendingSelection) {
      this.selectionRef.current = pendingSelection;
      this.pendingSelectionRef.current = null;
    }

    if (this.shouldFocusAfterSyncRef.current) {
      this.shouldFocusAfterSyncRef.current = false;
      const targetSelection = this.selectionRef.current;
      editor.focus(() => {
        if (targetSelection) {
          syncLexicalSelectionFromChatComposerSelection(editor, targetSelection);
        }
      });
    }
  };

  publishSnapshot = (
    snapshot: ChatComposerEditorSnapshot,
    callbacks: ChatComposerLexicalOwnerCallbacks,
    options?: PublishOptions,
  ): void => {
    this.selectionRef.current = snapshot.selection;
    this.pendingSelectionRef.current = snapshot.selection;

    if (options?.focusAfterSync) {
      this.shouldFocusAfterSyncRef.current = true;
    }

    const signature = getChatComposerNodesSignature(snapshot.nodes);
    const { editor } = this;
    this.pendingOwnerSignatureRef.current = signature;
    if (editor) {
      this.startApplyingExternalUpdate();
      syncLexicalEditorFromChatComposerState(editor, snapshot.nodes, snapshot.selection);
      this.editorSignatureRef.current = signature;
    }
    callbacks.onInputSurfaceSnapshotChange?.(
      snapshot.nodes,
      snapshot.selection,
      options?.inputSurfaceReason ?? { type: 'programmatic' },
    );

    if (signature !== this.lastPublishedSignatureRef.current) {
      this.lastPublishedSignatureRef.current = signature;
      callbacks.onNodesChange(snapshot.nodes);
    }
  };

  focusComposer = (): void => {
    const { editor } = this;
    if (!editor) {
      return;
    }

    editor.getRootElement()?.focus({ preventScroll: true });
    const targetSelection = this.selectionRef.current;
    if (targetSelection) {
      syncLexicalSelectionFromChatComposerSelection(editor, targetSelection);
    }
    editor.focus();
  };

  focusComposerAtEnd = (nodes?: ChatComposerNode[]): void => {
    const { editor } = this;
    if (!editor) {
      return;
    }
    const targetNodes = nodes ?? readChatComposerSnapshotFromEditorState(editor.getEditorState()).nodes;
    const end = getChatComposerDocumentLength(targetNodes);
    const targetSelection = { start: end, end };
    this.selectionRef.current = targetSelection;
    this.pendingSelectionRef.current = targetSelection;
    editor.getRootElement()?.focus({ preventScroll: true });
    if (nodes) {
      this.startApplyingExternalUpdate();
      const signature = getChatComposerNodesSignature(nodes);
      syncLexicalEditorFromChatComposerState(editor, nodes, targetSelection);
      this.editorSignatureRef.current = signature;
      this.lastPublishedSignatureRef.current = signature;
    } else {
      syncLexicalSelectionFromChatComposerSelection(editor, targetSelection);
    }
    editor.focus(() => {
      syncLexicalSelectionFromChatComposerSelection(editor, targetSelection);
    });
  };

  readComposerSnapshot = (fallbackNodes: ChatComposerNode[]): ChatComposerEditorSnapshot => {
    const { editor } = this;
    if (!editor) {
      return {
        nodes: fallbackNodes,
        selection: this.selectionRef.current,
      };
    }
    const snapshot = readChatComposerSnapshotFromEditorState(editor.getEditorState());
    this.selectionRef.current = snapshot.selection;
    return snapshot;
  };

  createHandle = () => {
    const insertInputSurfaceItem = (
      item: ChatInputSurfaceItem,
      triggerSpecs: readonly ChatInputSurfaceTriggerSpec[] = [CHAT_INPUT_SURFACE_SLASH_TRIGGER_SPEC],
    ): void => {
      const { callbacks } = this.getRuntime();
      callbacks.onInputSurfaceItemSelect?.(item);
      this.publishRuntimeSnapshot(
        (snapshot) => insertInputSurfaceItemIntoChatComposer({
          item,
          nodes: snapshot.nodes,
          selection: snapshot.selection,
          triggerSpecs,
        }),
        { focusAfterSync: true },
      );
    };

    return {
      insertInputSurfaceItem,
      insertSlashItem: (item: ChatSlashItem): void => {
        insertInputSurfaceItem(item);
      },
      insertFileToken: (tokenKey: string, label: string): void => {
        this.publishRuntimeSnapshot(
          (snapshot) => insertFileTokenIntoChatComposer({
            label,
            nodes: snapshot.nodes,
            selection: snapshot.selection,
            tokenKey,
          }),
          { focusAfterSync: true },
        );
      },
      insertFileTokens: (tokens: Array<{ tokenKey: string; label: string }>): void => {
        this.publishRuntimeSnapshot(
          (snapshot) =>
            tokens.reduce(
              (nextSnapshot, token) =>
                insertFileTokenIntoChatComposer({
                  label: token.label,
                  nodes: nextSnapshot.nodes,
                  selection: nextSnapshot.selection,
                  tokenKey: token.tokenKey,
                }),
              snapshot,
            ),
          { focusAfterSync: true },
        );
      },
      focusComposer: this.focusComposer,
      focusComposerAtEnd: this.focusComposerAtEnd,
      syncSelectedSkills: (nextKeys: string[], options: ChatSkillPickerOption[]): void => {
        this.publishRuntimeSnapshot(
          (snapshot) => syncSelectedSkillsIntoChatComposer({
            nextKeys,
            nodes: snapshot.nodes,
            options,
            selection: snapshot.selection,
          }),
          { focusAfterSync: true },
        );
      },
    };
  };

  handleBeforeInput = (params: {
    disabled: boolean;
    event: FormEvent<HTMLDivElement>;
  }): void => {
    const { disabled, event } = params;
    const { callbacks, fallbackNodes } = this.getRuntime();
    handleLexicalComposerBeforeInput({
      disabled,
      event,
      isComposing: this.editor?.isComposing() ?? false,
      publishSnapshot: (snapshot, options) => this.publishSnapshot(snapshot, callbacks, options),
      snapshotReader: () => this.readComposerSnapshot(fallbackNodes),
    });
  };

  handleKeyDown = (params: {
    actions: ComposerActions;
    callbacks: ChatComposerLexicalOwnerCallbacks;
    event: KeyboardEvent;
    fallbackNodes: ChatComposerNode[];
  }): boolean => {
    const { actions, callbacks, event, fallbackNodes } = params;
    if (
      event.key.length === 1 &&
      !event.isComposing &&
      !this.editor?.isComposing() &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      this.pendingInputSurfaceReasonRef.current = { type: 'insert-text', text: event.key };
    }

    const snapshot = this.readComposerSnapshot(fallbackNodes);
    if (callbacks.onInputSurfaceKeyDown?.(event)) {
      return true;
    }
    return handleLexicalComposerKeyboardCommand({
      actions,
      nativeEvent: event,
      publishSnapshot: (nextSnapshot, options) => this.publishSnapshot(nextSnapshot, callbacks, options),
      snapshot,
    });
  };

  handleEditorUpdate = (editorState: EditorState, callbacks: ChatComposerLexicalOwnerCallbacks): void => {
    const snapshot = readChatComposerSnapshotFromEditorState(editorState);
    const signature = getChatComposerNodesSignature(snapshot.nodes);

    this.editorSignatureRef.current = signature;

    if (this.isApplyingExternalUpdateRef.current || this.editor?.isComposing()) {
      return;
    }

    this.selectionRef.current = snapshot.selection;
    callbacks.onInputSurfaceSnapshotChange?.(
      snapshot.nodes,
      snapshot.selection,
      this.consumeInputSurfaceReason() ?? { type: 'sync' },
    );

    if (signature === this.lastPublishedSignatureRef.current) {
      return;
    }

    this.lastPublishedSignatureRef.current = signature;
    callbacks.onNodesChange(snapshot.nodes);
  };

  handleSelectionChange = (editor: LexicalEditor, callbacks: ChatComposerLexicalOwnerCallbacks): void => {
    const snapshot = readChatComposerSnapshotFromEditorState(editor.getEditorState());
    if (editor.isComposing()) {
      return;
    }
    this.selectionRef.current = snapshot.selection;
    callbacks.onInputSurfaceSnapshotChange?.(snapshot.nodes, snapshot.selection, { type: 'selection' });
  };

  private consumeInputSurfaceReason = (): ChatInputSurfaceTriggerChangeReason | null => {
    const reason = this.pendingInputSurfaceReasonRef.current;
    this.pendingInputSurfaceReasonRef.current = null;
    return reason;
  };

  private publishRuntimeSnapshot = (
    createSnapshot: (snapshot: ChatComposerEditorSnapshot) => ChatComposerEditorSnapshot,
    options: PublishOptions,
  ): void => {
    const { callbacks, fallbackNodes } = this.getRuntime();
    this.publishSnapshot(createSnapshot(this.readComposerSnapshot(fallbackNodes)), callbacks, options);
  };

  private startApplyingExternalUpdate = (): void => {
    this.isApplyingExternalUpdateRef.current = true;
    requestAnimationFrame(() => {
      this.isApplyingExternalUpdateRef.current = false;
    });
  };

  private getRuntime = (): ComposerRuntime => {
    if (!this.runtime) {
      throw new Error('ChatComposerLexicalOwner runtime has not been configured.');
    }
    return this.runtime;
  };
}
