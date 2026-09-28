import { Type, Heading1, Heading2, Heading3, List, ListOrdered, ListTodo, Quote, Table2, Code2, Sigma, Image, Link, Minus, ChevronRight, Lightbulb } from "lucide-react";
import type { MarkdownEditorLabels, MarkdownSlashItem } from "../types/markdown-editor.types";

/** Insertion surfaces consume this catalog; editing state remains in the editor manager. */
export const markdownCommands = [
  { id: "paragraph", icon: Type, group: "text", keywords: "text paragraph 正文" },
  { id: "h1", icon: Heading1, group: "text", keywords: "heading title 标题" },
  { id: "h2", icon: Heading2, group: "text", keywords: "heading title 标题" },
  { id: "h3", icon: Heading3, group: "text", keywords: "heading title 标题" },
  { id: "list", icon: List, group: "text", keywords: "bullet list 无序 项目" },
  { id: "orderedList", icon: ListOrdered, group: "text", keywords: "number ordered list 编号 步骤" },
  { id: "taskList", icon: ListTodo, group: "text", keywords: "todo task checkbox 待办 任务" },
  { id: "quote", icon: Quote, group: "text", keywords: "quote 引用" },
  { id: "toggle", icon: ChevronRight, group: "text", keywords: "toggle details collapse 折叠 展开" },
  { id: "callout", icon: Lightbulb, group: "text", keywords: "callout alert note 提示 强调" },
  { id: "divider", icon: Minus, group: "text", keywords: "divider separator 分隔" },
  { id: "table", icon: Table2, group: "advanced", keywords: "table grid 表格" },
  { id: "codeBlock", icon: Code2, group: "advanced", keywords: "code block snippet 代码" },
  { id: "inlineMath", icon: Sigma, group: "advanced", keywords: "math equation latex inline 公式" },
  { id: "math", icon: Sigma, group: "advanced", keywords: "math equation latex block display 公式" },
  { id: "image", icon: Image, group: "advanced", keywords: "image picture photo 图片" },
  { id: "link", icon: Link, group: "advanced", keywords: "link url 链接" },
] as const;

export function markdownCommandItems(labels: MarkdownEditorLabels): MarkdownSlashItem[] {
  return markdownCommands.map(item => ({ ...item,
    label: item.id === "list" ? labels.list : item.id === "math" ? labels.rich.blockMath
      : /^h[123]$/.test(item.id) ? `${labels.rich.heading} ${item.id.slice(1)}`
      : labels.rich[item.id as Exclude<typeof item.id, "h1" | "h2" | "h3" | "list" | "math">],
  }));
}
