import {
  COMPOSITION_END_TAG,
  SKIP_DOM_SELECTION_TAG,
  createEditor,
  type LexicalEditor,
} from "lexical";
import { describe, expect, it, vi } from "vitest";
import {
  createChatComposerTextNode,
  serializeChatComposerPlainText,
} from "@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils";
import {
  CHAT_COMPOSER_EXTERNAL_UPDATE_TAG,
  readChatComposerSnapshotFromEditorState,
  writeChatComposerStateToLexicalRoot,
} from "@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-adapter";
import { ChatComposerTokenNode } from "@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-token-node";
import { ChatComposerLexicalOwner } from "@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/owners/chat-composer-lexical-owner";

describe("ChatComposerLexicalOwner", () => {
  it("does not rewrite the editor while Lexical owns an active composition", () => {
    const update = vi.fn();
    const editor = {
      getRootElement: () => null,
      isComposing: () => true,
      update,
    } as unknown as LexicalEditor;
    const owner = new ChatComposerLexicalOwner();

    owner.syncExternalState(editor, [createChatComposerTextNode("draft")]);

    expect(update).not.toHaveBeenCalled();
  });

  it("applies an external clear after composition ends without publishing the stale draft", async () => {
    const draftNodes = [createChatComposerTextNode("已经发送的消息")];
    const editor = createEditor({
      namespace: "external-clear-after-composition",
      nodes: [ChatComposerTokenNode],
      onError: (error) => { throw error; },
    });
    editor.update(() => writeChatComposerStateToLexicalRoot(draftNodes, null), { discrete: true });
    let isComposing = true;
    vi.spyOn(editor, "isComposing").mockImplementation(() => isComposing);
    const onNodesChange = vi.fn();
    const owner = new ChatComposerLexicalOwner();
    owner.bindEditor(editor);

    owner.syncExternalState(editor, []);
    expect(serializeChatComposerPlainText(
      readChatComposerSnapshotFromEditorState(editor.getEditorState()).nodes,
    )).toBe("已经发送的消息");

    isComposing = false;
    owner.handleEditorUpdate(
      editor.getEditorState(),
      { onNodesChange },
      new Set([COMPOSITION_END_TAG]),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(serializeChatComposerPlainText(
      readChatComposerSnapshotFromEditorState(editor.getEditorState()).nodes,
    )).toBe("");
    expect(onNodesChange).not.toHaveBeenCalled();
  });

  it("publishes the completed composition when no newer external state exists", () => {
    const editor = createEditor({
      namespace: "publish-completed-composition",
      nodes: [ChatComposerTokenNode],
      onError: (error) => { throw error; },
    });
    const owner = new ChatComposerLexicalOwner();
    owner.bindEditor(editor);
    editor.update(
      () => writeChatComposerStateToLexicalRoot(
        [createChatComposerTextNode("正常完成的输入")],
        null,
      ),
      { discrete: true },
    );
    const onNodesChange = vi.fn();

    owner.handleEditorUpdate(
      editor.getEditorState(),
      { onNodesChange },
      new Set([COMPOSITION_END_TAG]),
    );

    expect(onNodesChange).toHaveBeenCalledWith([
      expect.objectContaining({ type: "text", text: "正常完成的输入" }),
    ]);
  });

  it("keeps background document sync from replacing the page DOM selection", () => {
    const update = vi.fn();
    const editor = { getRootElement: () => null, isComposing: () => false, update } as unknown as LexicalEditor;
    const owner = new ChatComposerLexicalOwner();

    owner.syncExternalState(editor, [createChatComposerTextNode("draft")]);

    expect(update).toHaveBeenCalledWith(expect.any(Function), {
      tag: [CHAT_COMPOSER_EXTERNAL_UPDATE_TAG, SKIP_DOM_SELECTION_TAG],
    });
  });

  it("keeps background caret sync from replacing the page DOM selection", () => {
    const update = vi.fn();
    const editor = { getRootElement: () => null, isComposing: () => false, update } as unknown as LexicalEditor;
    const owner = new ChatComposerLexicalOwner();
    const nodes = [createChatComposerTextNode("draft")];
    owner.syncExternalState(editor, nodes);
    update.mockClear();
    owner.pendingSelectionRef.current = { start: 5, end: 5 };

    owner.syncExternalState(editor, nodes);

    expect(update).toHaveBeenCalledWith(expect.any(Function), {
      tag: [CHAT_COMPOSER_EXTERNAL_UPDATE_TAG, SKIP_DOM_SELECTION_TAG],
    });
  });

  it("restores the DOM caret when the composer owns focus", () => {
    const rootElement = document.createElement("div");
    rootElement.tabIndex = 0;
    document.body.append(rootElement);
    rootElement.focus();
    const update = vi.fn();
    const editor = {
      getRootElement: () => rootElement,
      isComposing: () => false,
      update,
    } as unknown as LexicalEditor;
    const owner = new ChatComposerLexicalOwner();

    owner.syncExternalState(editor, [createChatComposerTextNode("draft")]);

    expect(update).toHaveBeenCalledWith(expect.any(Function), {
      tag: CHAT_COMPOSER_EXTERNAL_UPDATE_TAG,
    });
    rootElement.remove();
  });
});
