import { describe, expect, it } from "vitest";
import type { ChatMessagePartViewModel } from "@agent-chat-ui/components/chat/view-models/chat-ui.types";
import {
  formatToolActivityGroupLabel,
  groupConsecutiveToolParts,
  resolveToolActivityFamily,
  type ChatToolActivityGroupLabels,
} from "./chat-tool-activity-group.utils";

const labels: ChatToolActivityGroupLabels = {
  segmentTemplates: {
    read: { one: "Read 1 file", other: "Read {count} files" },
    edit: { one: "Edit 1 file", other: "Edit {count} files" },
    search: { one: "Search 1 time", other: "Search {count} times" },
    bash: { one: "Run 1 command", other: "Run {count} commands" },
    web: { one: "Open 1 page", other: "Open {count} pages" },
    agent: { one: "Start 1 subtask", other: "Start {count} subtasks" },
    panel: { one: "Show 1 result", other: "Show {count} results" },
    other: { one: "Use 1 tool", other: "Use {count} tools" },
  },
  failedLabel: "failed",
  cancelledLabel: "cancelled",
};

const zhLabels: ChatToolActivityGroupLabels = {
  segmentTemplates: {
    read: { one: "读取 1 个文件", other: "读取 {count} 个文件" },
    edit: { one: "编辑 1 个文件", other: "编辑 {count} 个文件" },
    search: { one: "搜索 1 次", other: "搜索 {count} 次" },
    bash: { one: "运行 1 条命令", other: "运行 {count} 条命令" },
    web: { one: "访问 1 个网页", other: "访问 {count} 个网页" },
    agent: { one: "启动 1 个子任务", other: "启动 {count} 个子任务" },
    panel: { one: "展示 1 个结果", other: "展示 {count} 个结果" },
    other: { one: "调用 1 个工具", other: "调用 {count} 个工具" },
  },
  failedLabel: "失败",
  cancelledLabel: "已取消",
};

function toolCard(
  toolName: string,
  summary?: string,
  statusTone: "success" | "error" | "cancelled" | "running" = "success",
): Extract<ChatMessagePartViewModel, { type: "tool-card" }> {
  return {
    type: "tool-card",
    card: {
      kind: "result",
      toolName,
      summary,
      hasResult: true,
      statusTone,
      statusLabel: statusTone,
      titleLabel: "Tool",
      outputLabel: "Output",
      emptyLabel: "Empty",
    },
  };
}

describe("resolveToolActivityFamily", () => {
  it("maps common tool names into semantic families", () => {
    expect(resolveToolActivityFamily("read_file")).toBe("read");
    expect(resolveToolActivityFamily("edit_file")).toBe("edit");
    expect(resolveToolActivityFamily("grep_search")).toBe("search");
    expect(resolveToolActivityFamily("exec_command")).toBe("bash");
    expect(resolveToolActivityFamily("read_url_content")).toBe("web");
    expect(resolveToolActivityFamily("spawn")).toBe("agent");
    expect(resolveToolActivityFamily("show_content")).toBe("panel");
  });
});

describe("groupConsecutiveToolParts", () => {
  it("groups consecutive tools with natural category+count phrases", () => {
    const parts: ChatMessagePartViewModel[] = [
      toolCard("read_file", "path: a.ts"),
      toolCard("read_file", "path: b.ts"),
      toolCard("exec_command", "command: pnpm test"),
      { type: "markdown", text: "mid text" },
      toolCard("grep_search", "query: hover"),
      toolCard("grep_search", "query: token"),
      { type: "markdown", text: "final" },
    ];

    const blocks = groupConsecutiveToolParts(parts, labels);
    expect(blocks.map((block) => block.kind)).toEqual([
      "tool-group",
      "part",
      "tool-group",
      "part",
    ]);
    expect(blocks[0]).toMatchObject({
      kind: "tool-group",
      group: {
        label: "Read 2 files · Run 1 command",
      },
    });
    expect(blocks[2]).toMatchObject({
      kind: "tool-group",
      group: {
        label: "Search 2 times",
      },
    });
  });

  it("uses natural Chinese phrases without stacked wording", () => {
    const parts: ChatMessagePartViewModel[] = [
      toolCard("read_file"),
      toolCard("read_file"),
      toolCard("exec_command"),
      toolCard("grep_search"),
    ];
    const blocks = groupConsecutiveToolParts(parts, zhLabels);
    expect(blocks[0]).toMatchObject({
      kind: "tool-group",
      group: {
        label: "读取 2 个文件 · 运行 1 条命令 · 搜索 1 次",
      },
    });
    expect(String((blocks[0] as { group: { label: string } }).group.label)).not.toContain(
      "命令 1 条命令",
    );
  });

  it("does not group a single tool card", () => {
    const parts: ChatMessagePartViewModel[] = [
      toolCard("read_file", "path: only.ts"),
      { type: "markdown", text: "answer" },
    ];
    const blocks = groupConsecutiveToolParts(parts, labels);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.kind).toBe("part");
  });

  it("keeps reasoning inside one tool group without including it in the summary", () => {
    const parts: ChatMessagePartViewModel[] = [
      toolCard("read_file"),
      toolCard("read_file"),
      { type: "reasoning", label: "Thinking", text: "pause" },
      toolCard("exec_command"),
      toolCard("exec_command"),
    ];
    const blocks = groupConsecutiveToolParts(parts, labels);
    expect(blocks.map((block) => block.kind)).toEqual(["tool-group"]);
    expect(blocks[0]).toMatchObject({
      group: {
        label: "Read 2 files · Run 2 commands",
        parts: [
          { type: "tool-card" },
          { type: "tool-card" },
          { type: "reasoning", text: "pause" },
          { type: "tool-card" },
          { type: "tool-card" },
        ],
      },
    });
  });
});

describe("formatToolActivityGroupLabel", () => {
  it("uses natural phrases and prioritizes failed families", () => {
    const blocks = groupConsecutiveToolParts(
      [
        toolCard("read_file", "path: ok.ts"),
        toolCard("exec_command", "command: pnpm test", "error"),
      ],
      labels,
    );
    expect(blocks[0]).toMatchObject({
      kind: "tool-group",
      group: {
        label: "Run 1 command failed · Read 1 file",
      },
    });
    const label = formatToolActivityGroupLabel({
      segments: [
        { family: "read", count: 3, tone: "success" },
        { family: "bash", count: 2, tone: "success" },
      ],
      labels,
    });
    expect(label).toBe("Read 3 files · Run 2 commands");
    expect(label.toLowerCase()).not.toContain("used");
    expect(label).not.toContain("pnpm");
  });
});
