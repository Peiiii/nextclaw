import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceTextSelectionMenu } from "@/features/chat/features/workspace/components/workspace-text-selection-menu";

describe("WorkspaceTextSelectionMenu", () => {
  it("adds the selected text snapshot with its source lines", async () => {
    const onAddToChat = vi.fn();
    render(
      <WorkspaceTextSelectionMenu
        fileLabel="guide.md"
        filePath="docs/guide.md"
        sourceStartLine={20}
        sourceText={"first line\nselected text\nlast line"}
        onAddToChat={onAddToChat}
      >
        <p>selected text</p>
      </WorkspaceTextSelectionMenu>,
    );

    const selectedText = screen.getByText("selected text");
    fireEvent.pointerDown(selectedText);
    const textNode = selectedText.firstChild;
    expect(textNode).toBeTruthy();
    const range = document.createRange();
    range.selectNodeContents(textNode!);
    range.getBoundingClientRect = () => ({
      bottom: 80,
      height: 20,
      left: 100,
      right: 200,
      top: 60,
      width: 100,
      x: 100,
      y: 60,
      toJSON: () => ({}),
    });
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    expect(screen.queryByRole("button", { name: /Add to chat|添加到聊天/ })).toBeNull();

    fireEvent.pointerUp(selectedText);
    const menu = await screen.findByRole("button", { name: /Add to chat|添加到聊天/ });
    await waitFor(() => expect(menu.style.visibility).toBe("visible"));
    expect(menu.style.top).toBe("50px");
    fireEvent.click(menu);

    expect(onAddToChat).toHaveBeenCalledWith({
      path: "docs/guide.md",
      label: "guide.md",
      excerpt: "selected text",
      startLine: 21,
      endLine: 21,
    });
  });

  it("handles the first selectionchange after mount and keeps the menu inside the viewport", async () => {
    const widthSpy = vi.spyOn(window, "innerWidth", "get").mockReturnValue(320);
    const heightSpy = vi.spyOn(window, "innerHeight", "get").mockReturnValue(240);
    const buttonRectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 36,
      height: 36,
      left: 0,
      right: 120,
      top: 0,
      width: 120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    render(
      <WorkspaceTextSelectionMenu
        fileLabel="guide.md"
        filePath="docs/guide.md"
        sourceText={"first selected line\nlast selected line"}
        onAddToChat={vi.fn()}
      >
        <p>first selected line<br />last selected line</p>
      </WorkspaceTextSelectionMenu>,
    );

    const paragraph = screen.getByText((_, element) =>
      element?.tagName === "P" && element.textContent === "first selected linelast selected line"
    );
    expect(paragraph).toBeTruthy();
    const range = document.createRange();
    range.selectNodeContents(paragraph!);
    Object.defineProperty(range, "getClientRects", {
      value: () => [
        { bottom: 40, height: 20, left: 20, right: 180, top: 20, width: 160 },
        { bottom: 120, height: 20, left: 280, right: 320, top: 100, width: 40 },
      ],
    });
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    document.dispatchEvent(new Event("selectionchange"));

    const menu = await screen.findByRole("button", { name: /Add to chat|添加到聊天/ });
    await waitFor(() => expect(menu.style.visibility).toBe("visible"));
    expect(menu.style.left).toBe("110px");
    expect(menu.style.top).toBe("130px");
    expect(menu.className).toContain("whitespace-nowrap");

    buttonRectSpy.mockRestore();
    widthSpy.mockRestore();
    heightSpy.mockRestore();
  });
});
