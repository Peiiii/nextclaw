import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ChatFileOperationBlockViewModel } from "@nextclaw/agent-chat-ui";
import { ChatSessionWorkspaceFilePreview } from "@/features/chat/features/workspace/components/chat-session-workspace-file-preview";

vi.mock("@/shared/hooks/use-server-path-read", () => ({
  useServerPathRead: () => ({
    data: {
      kind: "text",
      languageHint: "json",
      resolvedPath: "/tmp/package.json",
      startLine: 1,
      text: '{\n  "name": "nextclaw"\n}',
      truncated: false,
    },
    error: null,
    isLoading: false,
  }),
}));

vi.mock("@/shared/hooks/use-server-path-browse", () => ({
  useServerPathBrowse: () => ({ data: null, error: null, isLoading: false }),
}));

vi.mock("@nextclaw/agent-chat-ui", () => ({
  ChatMessageMarkdown: ({ text }: { text: string }) => <div>{text}</div>,
  FileOperationCodeSurface: ({ block }: { block: ChatFileOperationBlockViewModel }) => (
    <div data-testid="json-source-preview">
      {block.lines.map(({ text }, index) => <span key={index}>{text}{"\n"}</span>)}
    </div>
  ),
}));

it("supports the first text selection in a JSON preview", async () => {
  const onTextExcerptAdd = vi.fn();
  render(
    <ChatSessionWorkspaceFilePreview
      file={{
        key: "package-json",
        label: "package.json",
        parentSessionKey: null,
        path: "/tmp/package.json",
        viewMode: "preview",
      }}
      sessionProjectRoot="/tmp"
      sessionWorkingDir="/tmp"
      onFileOpen={vi.fn()}
      onTextExcerptAdd={onTextExcerptAdd}
    />,
  );

  const selectedLine = screen.getByText(/"name": "nextclaw"/);
  const range = document.createRange();
  range.selectNodeContents(selectedLine);
  Object.defineProperty(range, "getClientRects", {
    value: () => [
      { bottom: 80, height: 20, left: 40, right: 220, top: 60, width: 180 },
    ],
  });
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));

  fireEvent.click(await screen.findByRole("button", {
    name: /Add to chat|添加到聊天/,
  }));

  expect(onTextExcerptAdd).toHaveBeenCalledWith({
    path: "package.json",
    label: "package.json",
    excerpt: '"name": "nextclaw"',
    startLine: 2,
    endLine: 2,
  });
});
