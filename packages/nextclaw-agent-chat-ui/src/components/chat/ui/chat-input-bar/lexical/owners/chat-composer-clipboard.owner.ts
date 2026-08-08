import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  COPY_COMMAND,
  CUT_COMMAND,
  PASTE_COMMAND,
  mergeRegister,
  type LexicalEditor,
} from 'lexical';
import {
  insertChatComposerNodesAtSelection,
  readChatComposerSnapshotFromEditorState,
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-adapter';
import {
  CHAT_COMPOSER_CLIPBOARD_MIME_TYPE,
  parseChatComposerClipboard,
  serializeChatComposerClipboard,
  serializeChatComposerClipboardPlainText,
  sliceChatComposerRange,
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-clipboard.utils';

function isClipboardEvent(event: Event | null): event is ClipboardEvent {
  return Boolean(event && 'clipboardData' in event);
}

export class ChatComposerClipboardOwner {
  constructor(private readonly editor: LexicalEditor) {}

  register = (): (() => void) => mergeRegister(
    this.editor.registerCommand(
      COPY_COMMAND,
      (event) => this.handleCopy(event, false),
      COMMAND_PRIORITY_HIGH,
    ),
    this.editor.registerCommand(
      CUT_COMMAND,
      (event) => this.handleCopy(event, true),
      COMMAND_PRIORITY_HIGH,
    ),
    this.editor.registerCommand(
      PASTE_COMMAND,
      this.handlePaste,
      COMMAND_PRIORITY_HIGH,
    ),
  );

  private readonly handleCopy = (
    event: Event | null,
    cut: boolean,
  ): boolean => {
    if (!isClipboardEvent(event) || !event.clipboardData) {
      return false;
    }
    const snapshot = readChatComposerSnapshotFromEditorState(
      this.editor.getEditorState(),
    );
    if (!snapshot.selection || snapshot.selection.start === snapshot.selection.end) {
      return false;
    }
    const selectedNodes = sliceChatComposerRange(
      snapshot.nodes,
      snapshot.selection.start,
      snapshot.selection.end,
    );
    if (!selectedNodes.some((node) => node.type === 'token')) {
      return false;
    }
    try {
      event.clipboardData.setData(
        'text/plain',
        serializeChatComposerClipboardPlainText(selectedNodes),
      );
      event.clipboardData.setData(
        CHAT_COMPOSER_CLIPBOARD_MIME_TYPE,
        serializeChatComposerClipboard(selectedNodes),
      );
    } catch {
      event.preventDefault();
      return true;
    }
    event.preventDefault();
    if (cut) {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.removeText();
      }
    }
    return true;
  };

  private readonly handlePaste = (event: Event): boolean => {
    if (!isClipboardEvent(event)) {
      return false;
    }
    const serialized = event.clipboardData?.getData(
      CHAT_COMPOSER_CLIPBOARD_MIME_TYPE,
    );
    if (!serialized) {
      return false;
    }
    const nodes = parseChatComposerClipboard(serialized);
    if (!nodes || !insertChatComposerNodesAtSelection(nodes)) {
      return false;
    }
    event.preventDefault();
    return true;
  };
}
