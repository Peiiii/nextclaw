import { SKIP_DOM_SELECTION_TAG, type LexicalEditor } from "lexical";
import { describe, expect, it, vi } from "vitest";
import { createChatComposerTextNode } from "@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils";
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

  it("keeps background document sync from replacing the page DOM selection", () => {
    const update = vi.fn();
    const editor = { getRootElement: () => null, isComposing: () => false, update } as unknown as LexicalEditor;
    const owner = new ChatComposerLexicalOwner();

    owner.syncExternalState(editor, [createChatComposerTextNode("draft")]);

    expect(update).toHaveBeenCalledWith(expect.any(Function), {
      tag: SKIP_DOM_SELECTION_TAG,
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
      tag: SKIP_DOM_SELECTION_TAG,
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

    expect(update).toHaveBeenCalledWith(expect.any(Function), undefined);
    rootElement.remove();
  });
});
