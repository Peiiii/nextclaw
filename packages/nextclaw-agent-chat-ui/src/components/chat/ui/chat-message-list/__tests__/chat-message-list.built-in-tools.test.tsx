import { render, screen } from "@testing-library/react";
import { ChatMessageList } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-message-list";

function statusLabels(success: string) {
  return {
    running: `Running ${success}`,
    success,
    error: `Failed ${success}`,
    cancelled: `Cancelled ${success}`,
  };
}

const texts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  copyMessageLabel: "Copy",
  copiedMessageLabel: "Copied",
  typingLabel: "Typing...",
  toolStatusLabels: {
    terminal: statusLabels("已执行"),
    fileRead: statusLabels("已读取"),
    fileEdit: statusLabels("已编辑"),
    search: statusLabels("已搜索"),
    builtIn: {
      directory: statusLabels("已查看目录"),
      web: statusLabels("已读取网页"),
      message: statusLabels("已发送消息"),
      session: statusLabels("已读取会话"),
      agent: statusLabels("已处理子任务"),
      memory: statusLabels("已访问记忆"),
      schedule: statusLabels("已管理定时任务"),
      system: statusLabels("已管理服务"),
      image: statusLabels("已查看图片"),
      display: statusLabels("已展示结果"),
    },
  },
};

function toolCard(toolName: string) {
  return {
    type: "tool-card" as const,
    card: {
      kind: "result" as const,
      toolName,
      summary: "path: workspace",
      hasResult: true,
      statusTone: "success" as const,
      statusLabel: "Completed",
      titleLabel: "Tool Result",
      outputLabel: "View Output",
      emptyLabel: "No output",
    },
  };
}

it.each([
  ["read_file", "已读取", "file-text"],
  ["write_file", "已编辑", "code-xml"],
  ["edit_file", "已编辑", "code-xml"],
  ["list_dir", "已查看目录", "folder-tree"],
  ["exec", "已执行", "terminal"],
  ["web_search", "已搜索", "search"],
  ["web_fetch", "已读取网页", "earth"],
  ["message", "已发送消息", "send"],
  ["sessions_list", "已读取会话", "message-square"],
  ["sessions_history", "已读取会话", "message-square"],
  ["sessions_request", "已读取会话", "message-square"],
  ["spawn", "已处理子任务", "bot"],
  ["sessions_spawn", "已处理子任务", "bot"],
  ["subagents", "已处理子任务", "bot"],
  ["memory_get", "已访问记忆", "brain"],
  ["memory_search", "已访问记忆", "brain"],
  ["cron", "已管理定时任务", "calendar-clock"],
  ["gateway", "已管理服务", "settings"],
  ["view_image", "已查看图片", "image"],
  ["show_file", "已展示结果", "eye"],
  ["show_url", "已展示结果", "eye"],
  ["show_panel_app", "已展示结果", "eye"],
  ["show_content", "已展示结果", "eye"],
])("renders built-in %s with localized status and semantic icon", (toolName, label, icon) => {
  const { container } = render(
    <ChatMessageList
      messages={[
        {
          id: `assistant-${toolName}`,
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:12",
          parts: [toolCard(toolName)],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={texts}
    />,
  );

  expect(screen.getByText(label)).toBeTruthy();
  expect(container.querySelector(`.lucide-${icon}`)).toBeTruthy();
  expect(screen.queryByText(toolName.replace(/_/g, " "))).toBeNull();
});

it("keeps unknown extension tools visually generic", () => {
  const { container } = render(
    <ChatMessageList
      messages={[
        {
          id: "assistant-custom-tool",
          role: "assistant",
          roleLabel: "Assistant",
          timestampLabel: "10:12",
          parts: [toolCard("custom_tool")],
        },
      ]}
      isSending={false}
      hasAssistantDraft={false}
      texts={texts}
    />,
  );

  expect(screen.getByText("custom tool")).toBeTruthy();
  expect(container.querySelector(".lucide-wrench")).toBeTruthy();
});
