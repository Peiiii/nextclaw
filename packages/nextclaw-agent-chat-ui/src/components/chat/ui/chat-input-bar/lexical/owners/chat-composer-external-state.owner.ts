import type { LexicalEditor } from 'lexical';
import type { ChatComposerNode } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { getChatComposerNodesSignature } from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-adapter';

type PendingExternalState = {
  readonly nodes: ChatComposerNode[];
  readonly revision: number;
};

type ApplyExternalState = (
  editor: LexicalEditor,
  nodes: ChatComposerNode[],
) => void;

export class ChatComposerExternalStateOwner {
  private revision = 0;
  private pendingState: PendingExternalState | null = null;

  deferWhileComposing = (
    editor: LexicalEditor,
    nodes: ChatComposerNode[],
    editorSignature: string,
  ): boolean => {
    const revision = this.revision + 1;
    this.revision = revision;
    if (!editor.isComposing()) {
      this.pendingState = null;
      return false;
    }
    this.pendingState = getChatComposerNodesSignature(nodes) === editorSignature
      ? null
      : { nodes: [...nodes], revision };
    return true;
  };

  flushAfterCompositionEnd = (
    isCompositionEnd: boolean,
    editor: LexicalEditor | null,
    apply: ApplyExternalState,
  ): boolean => {
    const pendingState = isCompositionEnd ? this.pendingState : null;
    if (!pendingState) return false;
    this.pendingState = null;
    queueMicrotask(() => {
      if (!editor || this.revision !== pendingState.revision) return;
      apply(editor, pendingState.nodes);
    });
    return true;
  };

  reset = (): void => {
    this.revision += 1;
    this.pendingState = null;
  };
}
