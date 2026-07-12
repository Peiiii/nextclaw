import { fireEvent, render, screen } from "@testing-library/react";
import { ChatMessageList } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-message-list";

const defaultTexts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  copyMessageLabel: "Copy",
  copiedMessageLabel: "Copied",
  typingLabel: "Typing...",
};

it("resets completed terminal cards to collapsed when the list remounts", () => {
  const message = {
    id: "assistant-tool-remount",
    role: "assistant" as const,
    roleLabel: "Assistant",
    timestampLabel: "10:11",
    parts: [
      {
        type: "tool-card" as const,
        card: {
          kind: "result" as const,
          toolName: "shell",
          summary: "cmd: pnpm test",
          output: "short finished output",
          hasResult: true,
          statusTone: "success" as const,
          statusLabel: "Completed",
          titleLabel: "Tool Result",
          outputLabel: "View Output",
          emptyLabel: "No output",
        },
      },
    ],
  };
  const { rerender } = render(
    <ChatMessageList
      key="session-a"
      messages={[message]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  fireEvent.click(screen.getByText("cmd: pnpm test"));
  expect(screen.getByText("short finished output")).toBeTruthy();

  rerender(
    <ChatMessageList
      key="session-b"
      messages={[message]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  expect(screen.queryByText("short finished output")).toBeNull();
});

it("renders structured terminal result objects without showing raw json payloads", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-terminal-object-output",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:15",
          parts: [
            {
              type: "tool-card",
              card: {
                kind: "result",
                toolName: "command_execution",
                summary: "command: echo hello",
                outputData: {
                  status: "completed",
                  command: "echo hello",
                  aggregated_output: "hello\n",
                  exit_code: 0,
                },
                hasResult: true,
                statusTone: "success",
                statusLabel: "Completed",
                titleLabel: "Tool Result",
                outputLabel: "View Output",
                emptyLabel: "No output",
              },
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  fireEvent.click(screen.getByText("echo hello"));

  expect(screen.getByTestId("chat-terminal-surface")).toBeTruthy();
  const content = screen.getByTestId("chat-terminal-surface").parentElement;
  expect(content?.className).toContain("pl-[calc(1.15em+0.375rem)]");
  expect(screen.getAllByText("hello")).toHaveLength(2);
  expect(screen.queryByText("zsh")).toBeNull();
  expect(screen.queryByText(/"aggregated_output":/)).toBeNull();
  expect(screen.queryByText(/"status": "completed"/)).toBeNull();
});

it("uses localized names for recognized tools while preserving their raw summaries", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-localized-terminal",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:17",
          parts: [
            {
              type: "tool-card",
              card: {
                kind: "result",
                toolName: "exec_command",
                summary: "command: pnpm test",
                hasResult: true,
                statusTone: "success",
                statusLabel: "Completed",
                titleLabel: "Tool Result",
                outputLabel: "View Output",
                emptyLabel: "No output",
              },
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={{
        ...defaultTexts,
        toolStatusLabels: {
          terminal: {
            running: "执行中",
            success: "已执行",
            error: "执行失败",
            cancelled: "已取消执行",
          },
          fileRead: {
            running: "读取中",
            success: "已读取",
            error: "读取失败",
            cancelled: "已取消读取",
          },
          fileEdit: {
            running: "编辑中",
            success: "已编辑",
            error: "编辑失败",
            cancelled: "已取消编辑",
          },
          search: {
            running: "搜索中",
            success: "已搜索",
            error: "搜索失败",
            cancelled: "已取消搜索",
          },
        },
      }}
    />,
  );

  expect(screen.getByText("已执行")).toBeTruthy();
  expect(screen.getByText("pnpm test")).toBeTruthy();
  expect(screen.queryByText("exec command")).toBeNull();
});

it("allows structured terminal results with no output to expand into an empty output state", () => {
  render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-terminal-empty-object-output",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:16",
          parts: [
            {
              type: "tool-card",
              card: {
                kind: "result",
                toolName: "command_execution",
                summary: "command: true",
                outputData: {
                  status: "completed",
                  command: "true",
                  stdout: "",
                  stderr: "",
                  exitCode: 0,
                },
                hasResult: true,
                statusTone: "success",
                statusLabel: "Completed",
                titleLabel: "Tool Result",
                outputLabel: "View Output",
                emptyLabel: "No output",
              },
            },
          ],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={defaultTexts}
    />,
  );

  fireEvent.click(screen.getByText("true"));

  expect(screen.getByTestId("chat-terminal-surface")).toBeTruthy();
  expect(screen.getByText("No output")).toBeTruthy();
  expect(screen.queryByText(/"stdout":/)).toBeNull();
});
