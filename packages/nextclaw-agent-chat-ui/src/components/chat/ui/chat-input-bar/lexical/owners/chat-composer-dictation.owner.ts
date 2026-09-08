import type { LexicalEditor } from 'lexical';
import type { ChatComposerDictationSession, ChatComposerNode } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { replaceChatComposerSelectionWithText, type ChatComposerEditorSnapshot } from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-adapter';
import type { ChatComposerLexicalOwner, ChatComposerLexicalOwnerCallbacks } from './chat-composer-lexical-owner';

/** Owns one reversible edit; completed instances ignore all late recognition results. */
export class ChatComposerDictationOwner implements ChatComposerDictationSession {
  private active = true;
  private text = '';
  private readonly original: ChatComposerEditorSnapshot;
  private readonly callbacks: ChatComposerLexicalOwnerCallbacks;
  private readonly cleanup: () => void;

  constructor(private readonly composer: ChatComposerLexicalOwner, editor: LexicalEditor,
    runtime: { fallbackNodes: ChatComposerNode[]; callbacks: ChatComposerLexicalOwnerCallbacks },
    private readonly onInterrupt: () => void) {
    const rememberedSelection = composer.selectionRef.current;
    this.original = composer.readComposerSnapshot(runtime.fallbackNodes);
    this.original.selection ??= rememberedSelection;
    this.callbacks = runtime.callbacks;
    this.cleanup = this.listen(editor.getRootElement());
  }

  isActive = (): boolean => this.active;

  update = (text: string, interim = ''): void => this.write(text, interim, true);

  private write = (text: string, interim: string, preview: boolean): void => {
    if (!this.active) return;
    const combined = text + (text && interim ? ' ' : '') + interim;
    this.text = combined;
    const snapshot = combined ? replaceChatComposerSelectionWithText({
      ...this.original, text: combined,
    }) : this.original;
    const end = snapshot.selection?.end ?? 0;
    this.composer.publishSnapshot(snapshot, this.callbacks, {
      preview,
      dictation: { range: interim ? { start: end - interim.length, end } : null },
    });
  };

  commit = (text?: string): void => {
    if (!this.active) return;
    this.write(text ?? this.text, '', false);
    this.active = false;
    this.cleanup();
  };

  cancel = (): void => {
    if (!this.active) return;
    this.active = false;
    this.cleanup();
    this.composer.publishSnapshot(this.original, this.callbacks, { dictation: { range: null } });
  };

  interrupt = (): void => {
    if (!this.active) return;
    this.commit();
    this.onInterrupt();
  };

  abandon = (): void => {
    if (!this.active) return;
    this.active = false;
    this.cleanup();
    this.onInterrupt();
  };

  private listen = (root: HTMLElement | null): (() => void) => {
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || ['Alt', 'Control', 'Meta', 'Shift'].includes(event.key)) return;
      if (event.key === 'Escape') {
        this.cancel(); this.onInterrupt(); event.preventDefault(); event.stopPropagation(); return;
      }
      this.interrupt();
      if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); }
    };
    root?.addEventListener('keydown', keydown, true);
    const events = ['beforeinput', 'compositionstart', 'paste', 'cut', 'pointerdown', 'drop'] as const;
    events.forEach((event) => root?.addEventListener(event, this.interrupt, true));
    return () => {
      root?.removeEventListener('keydown', keydown, true);
      events.forEach((event) => root?.removeEventListener(event, this.interrupt, true));
    };
  };
}
