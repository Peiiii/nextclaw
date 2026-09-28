import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Mathematics from "@tiptap/extension-mathematics";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { search } from "prosemirror-search";
import { RawMarkdownBlock, RawHtmlBlock, RawMarkdownInline, RawMarkdownDefinition } from "../utils/markdown-preservation.utils";
import { markdownCodeView } from "../components/markdown/markdown-node-views";
import type { MarkdownEditorLabels, MarkdownInspector } from "../types/markdown-editor.types";

const lowlight = createLowlight(common);
const Search = Extension.create({ name: "documentSearch", addProseMirrorPlugins: () => [search()] });

export function markdownEditorExtensions(labels: MarkdownEditorLabels, inspect: (value: MarkdownInspector) => void) {
  return [
    StarterKit.configure({ codeBlock: false, link: { openOnClick: false, autolink: false } }),
    Markdown, TableKit.configure({ table: { resizable: true } }),
    Image.configure({ inline: true }),
    TaskList, TaskItem.configure({ nested: true, HTMLAttributes: { "data-type": "taskItem" }, a11y: { checkboxLabel: (node) => `${labels.rich.taskList}: ${node.textContent}` } }),
    Mathematics.configure({
      katexOptions: { throwOnError: false },
      inlineOptions: { onClick: (node, position) => inspect({ kind: "math", value: node.attrs.latex, inline: true, position }) },
      blockOptions: { onClick: (node, position) => inspect({ kind: "math", value: node.attrs.latex, inline: false, position }) },
    }),
    CodeBlockLowlight.extend({ addNodeView() { return markdownCodeView(labels); } }).configure({ lowlight, defaultLanguage: "plaintext" }),
    RawMarkdownBlock, RawHtmlBlock, RawMarkdownInline, RawMarkdownDefinition, Search,
  ];
}
