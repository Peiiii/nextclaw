import {
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  type LexicalNode,
} from 'lexical';
import type { ChatInputBarActionsProps } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { $isChatComposerTokenNode } from './chat-composer-token-node';

type ComposerActions = Pick<
  ChatInputBarActionsProps,
  'onSend' | 'onStop' | 'isSending' | 'canStopGeneration'
>;

type ChatComposerKeyboardAction =
  | { type: 'noop' }
  | { type: 'send-message' }
  | { type: 'stop-generation' };

export function deleteAdjacentChatComposerToken(event: KeyboardEvent): boolean {
  if (event.key !== 'Backspace' && event.key !== 'Delete') {
    return false;
  }
  const selection = $getSelection();
  if ($isRangeSelection(selection) && !selection.isCollapsed()) {
    return false;
  }

  let candidate: LexicalNode | null = null;
  if ($isRangeSelection(selection)) {
    const { anchor } = selection;
    const anchorNode = anchor.getNode();
    if (anchor.type === 'element' && $isElementNode(anchorNode)) {
      const candidateIndex = event.key === 'Backspace' ? anchor.offset - 1 : anchor.offset;
      candidate = anchorNode.getChildAtIndex(candidateIndex);
    } else if (event.key === 'Backspace' && anchor.offset === 0) {
      candidate = anchorNode.getPreviousSibling();
    } else if (event.key === 'Delete' && anchor.offset === anchorNode.getTextContentSize()) {
      candidate = anchorNode.getNextSibling();
    }
  } else if (event.key === 'Backspace') {
    const paragraph = $getRoot().getFirstChild();
    candidate = $isElementNode(paragraph) ? paragraph.getLastChild() : null;
  }

  if ($isTextNode(candidate) && candidate.getTextContentSize() === 0) {
    candidate = event.key === 'Backspace'
      ? candidate.getPreviousSibling()
      : candidate.getNextSibling();
  }

  if (!$isChatComposerTokenNode(candidate)) {
    return false;
  }

  event.preventDefault();
  candidate.remove();
  return true;
}

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

  if (isComposing) {
    return { type: 'noop' };
  }

  if (key === 'Escape') {
    return isSending && canStopGeneration
      ? { type: 'stop-generation' }
      : { type: 'noop' };
  }

  if (key === 'Enter' && !shiftKey) {
    return { type: 'send-message' };
  }

  return { type: 'noop' };
}

export function handleLexicalComposerKeyboardCommand(params: {
  actions: ComposerActions;
  isComposing: boolean;
  nativeEvent: KeyboardEvent;
}): boolean {
  const { actions, isComposing, nativeEvent } = params;
  const action = resolveLexicalComposerKeyboardAction({
    canStopGeneration: actions.canStopGeneration,
    isComposing,
    isSending: actions.isSending,
    key: nativeEvent.key,
    shiftKey: nativeEvent.shiftKey,
  });

  if (action.type !== 'noop') {
    nativeEvent.preventDefault();
  }

  switch (action.type) {
    case 'stop-generation':
      void actions.onStop();
      return true;
    case 'send-message':
      void actions.onSend();
      return true;
    case 'noop':
      return false;
  }
}
