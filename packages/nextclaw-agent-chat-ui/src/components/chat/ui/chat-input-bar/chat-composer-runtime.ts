import type {
  ClipboardEvent,
  CompositionEvent,
  FormEvent,
  KeyboardEvent,
} from 'react';
import type {
  ChatComposerNode,
  ChatComposerSelection,
  ChatInputBarActionsProps,
  ChatSlashItem
} from '../../view-models/chat-ui.types';
import { ChatComposerController, type ChatComposerControllerSnapshot } from './chat-composer-controller';
import { ChatComposerViewController } from './chat-composer-view-controller';
import type { ChatInputBarTokenizedComposerHandle } from './chat-input-bar-tokenized-composer';

type ComposerActions = Pick<ChatInputBarActionsProps, 'onSend' | 'onStop' | 'isSending' | 'canStopGeneration'>;

type ChatComposerRuntimeConfig = {
  nodes: ChatComposerNode[];
  disabled: boolean;
  slashItems: ChatSlashItem[];
  actions: ComposerActions;
  onNodesChange: (nodes: ChatComposerNode[]) => void;
  onFilesAdd?: (files: File[]) => Promise<void> | void;
  onSlashQueryChange?: (query: string | null) => void;
  onSlashTriggerChange?: (trigger: { query: string; start: number; end: number } | null) => void;
  onSlashOpenChange: (open: boolean) => void;
  onSlashActiveIndexChange: (index: number) => void;
  activeSlashIndex: number;
  requestRender: () => void;
};

export type ChatComposerRuntimeViewModel = {
  snapshot: ChatComposerControllerSnapshot;
  selectedRange: ChatComposerSelection | null;
  bindRootElement: (node: HTMLDivElement | null) => void;
  handleBeforeInput: (event: FormEvent<HTMLDivElement>) => void;
  handleInput: (event: FormEvent<HTMLDivElement>) => void;
  handleCompositionStart: () => void;
  handleCompositionEnd: (event: CompositionEvent<HTMLDivElement>) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  handlePaste: (event: ClipboardEvent<HTMLDivElement>) => void;
  handleBlur: () => void;
  syncSelectionState: () => void;
  imperativeHandle: ChatInputBarTokenizedComposerHandle;
};

export class ChatComposerRuntime {
  private readonly controller = new ChatComposerController();
  private readonly viewController = new ChatComposerViewController(this.controller);
  private rootElement: HTMLDivElement | null = null;
  private selection: ChatComposerSelection | null = null;
  private selectedRange: ChatComposerSelection | null = null;
  private snapshot: ChatComposerControllerSnapshot = this.controller.getSnapshot();
  private config: ChatComposerRuntimeConfig | null = null;
  private isComposing = false;

  readonly bindRootElement = (node: HTMLDivElement | null): void => {
    this.rootElement = node;
  };

  readonly update = (config: ChatComposerRuntimeConfig): ChatComposerRuntimeViewModel => {
    this.config = config;
    this.snapshot = this.viewController.sync(config.nodes, this.selectedRange);
    return {
      snapshot: this.snapshot,
      selectedRange: this.selectedRange,
      bindRootElement: this.bindRootElement,
      handleBeforeInput: this.handleBeforeInput,
      handleInput: this.handleInput,
      handleCompositionStart: this.handleCompositionStart,
      handleCompositionEnd: this.handleCompositionEnd,
      handleKeyDown: this.handleKeyDown,
      handlePaste: this.handlePaste,
      handleBlur: this.handleBlur,
      syncSelectionState: this.syncSelectionState,
      imperativeHandle: this.createHandle()
    };
  };

  readonly createHandle = (): ChatInputBarTokenizedComposerHandle => {
    return {
      insertSlashItem: (item) => {
        this.viewController.insertSlashItem(item, this.commitSnapshot);
      },
      insertFileToken: (tokenKey, label) => {
        this.commitSnapshot(this.controller.insertFileToken(tokenKey, label));
        this.focusComposerSoon();
      },
      insertFileTokens: (tokens) => {
        let nextSnapshot: ChatComposerControllerSnapshot | null = null;
        for (const token of tokens) {
          nextSnapshot = this.controller.insertFileToken(token.tokenKey, token.label);
        }
        if (nextSnapshot) {
          this.commitSnapshot(nextSnapshot);
          this.focusComposerSoon();
        }
      },
      focusComposer: () => {
        this.focusComposer();
      },
      syncSelectedSkills: (nextKeys, options) => {
        this.viewController.syncSelectedSkills(nextKeys, options, this.commitSnapshot);
      }
    };
  };

  readonly restoreDomAfterCommit = (): void => {
    if (this.isComposing) {
      return;
    }
    this.viewController.restoreSelectionIfFocused(this.rootElement, this.selection);
  };

  readonly renderSurface = (): void => {
    if (this.isComposing) {
      return;
    }
    this.viewController.renderSurface({
      root: this.rootElement,
      snapshot: this.snapshot,
      selectedRange: this.selectedRange
    });
  };

  readonly syncViewport = (): void => {
    this.viewController.syncViewport(this.rootElement);
  };

  readonly syncSelectionState = (): void => {
    if (!this.rootElement || this.isComposing) {
      return;
    }
    const nextSnapshot = this.viewController.syncSelectionFromRoot(this.rootElement);
    this.selection = nextSnapshot.selection;
    this.selectedRange = nextSnapshot.selection;
    this.syncSlashState(nextSnapshot);
    this.requestRender();
  };

  readonly handleBeforeInput = (event: FormEvent<HTMLDivElement>): void => {
    this.viewController.handleBeforeInput({
      event,
      disabled: this.requireConfig().disabled,
      isComposing: this.isComposing,
      commitSnapshot: this.commitSnapshot
    });
  };

  readonly handleInput = (event: FormEvent<HTMLDivElement>): void => {
    this.viewController.handleInput({
      event,
      isComposing: this.isComposing,
      commitSnapshot: this.commitSnapshot
    });
  };

  readonly handleCompositionStart = (): void => {
    this.isComposing = true;
  };

  readonly handleCompositionEnd = (event: CompositionEvent<HTMLDivElement>): void => {
    this.isComposing = false;
    this.viewController.handleCompositionEnd({
      event,
      commitSnapshot: this.commitSnapshot
    });
  };

  readonly handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const config = this.requireConfig();
    if (this.rootElement && !this.isComposing) {
      const nextSnapshot = this.viewController.syncSelectionFromRoot(this.rootElement);
      this.selection = nextSnapshot.selection;
      this.selectedRange = nextSnapshot.selection;
      this.snapshot = nextSnapshot;
    }
    const activeSlashItem = config.slashItems[config.activeSlashIndex] ?? null;
    this.viewController.handleKeyDown({
      event,
      slashItems: config.slashItems,
      activeSlashIndex: config.activeSlashIndex,
      activeSlashItem,
      actions: config.actions,
      commitSnapshot: this.commitSnapshot,
      insertSkillToken: this.insertSkillToken,
      onSlashActiveIndexChange: config.onSlashActiveIndexChange,
      onSlashQueryChange: config.onSlashQueryChange,
      onSlashOpenChange: config.onSlashOpenChange
    });
  };

  readonly handlePaste = (event: ClipboardEvent<HTMLDivElement>): void => {
    this.viewController.handlePaste({
      event,
      onFilesAdd: this.requireConfig().onFilesAdd,
      commitSnapshot: this.commitSnapshot
    });
  };

  readonly handleBlur = (): void => {
    const config = this.requireConfig();
    this.isComposing = false;
    this.viewController.handleBlur({
      clearSelectedRange: this.clearSelectedRange,
      onSlashQueryChange: config.onSlashQueryChange,
      onSlashOpenChange: config.onSlashOpenChange
    });
  };

  private readonly setSelectedRange = (selection: ChatComposerSelection | null): void => {
    this.selectedRange = selection;
    this.selection = selection;
    this.requestRender();
  };

  private readonly clearSelectedRange = (): void => {
    this.selectedRange = null;
    this.requestRender();
  };

  private readonly commitSnapshot = (nextSnapshot: ChatComposerControllerSnapshot): void => {
    const config = this.requireConfig();
    this.selection = nextSnapshot.selection;
    this.selectedRange = nextSnapshot.selection;
    this.snapshot = nextSnapshot;
    config.onNodesChange(nextSnapshot.nodes);
    this.syncSlashState(nextSnapshot);
  };

  private readonly insertSkillToken = (tokenKey: string, label: string): void => {
    this.commitSnapshot(this.controller.insertSkillToken(tokenKey, label));
  };

  private readonly syncSlashState = (nextSnapshot: ChatComposerControllerSnapshot): void => {
    const config = this.requireConfig();
    config.onSlashTriggerChange?.(nextSnapshot.slashTrigger);
    config.onSlashQueryChange?.(nextSnapshot.slashTrigger?.query ?? null);
    config.onSlashOpenChange(nextSnapshot.slashTrigger !== null);
  };

  private readonly requestRender = (): void => {
    this.requireConfig().requestRender();
  };

  private readonly focusComposerSoon = (): void => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this.focusComposer());
      return;
    }
    this.focusComposer();
  };

  private readonly focusComposer = (): void => {
    if (!this.rootElement) {
      return;
    }
    this.rootElement.focus();
    this.viewController.restoreSelectionIfFocused(this.rootElement, this.selection);
  };

  private readonly requireConfig = (): ChatComposerRuntimeConfig => {
    if (!this.config) {
      throw new Error('ChatComposerRuntime is not configured.');
    }
    return this.config;
  };
}
