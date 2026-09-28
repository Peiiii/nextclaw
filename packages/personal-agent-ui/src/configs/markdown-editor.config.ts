import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Paragraph from "@tiptap/extension-paragraph";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { search } from "prosemirror-search";
import { RawMarkdownBlock, RawHtmlBlock, RawMarkdownInline, RawMarkdownDefinition } from "../utils/markdown-preservation.utils";
import { markdownCodeView, markdownImageView } from "../components/markdown/markdown-node-views";
import { markdownTableView } from "../components/markdown/markdown-table-view";
import type { MarkdownEditorLabels, MarkdownInspector } from "../types/markdown-editor.types";

const lowlight = createLowlight(common);
const Search = Extension.create({ name: "documentSearch", addProseMirrorPlugins: () => [search()] });

export function markdownEditorExtensions(labels: MarkdownEditorLabels, inspect: (value: MarkdownInspector) => void) {
  return [
    StarterKit.configure({ codeBlock: false, paragraph: false, link: { openOnClick: false, autolink: false } }),
    Paragraph.extend({ parseMarkdown: (token, helpers) => {
      // The upstream paragraph parser unwraps standalone images as block nodes.
      // Our images are inline, so their paragraph must remain in the document.
      if (token.tokens?.length === 1 && token.tokens[0].type === "image") return helpers.createNode("paragraph", undefined, helpers.parseInline(token.tokens));
      return Paragraph.config.parseMarkdown?.call(Paragraph, token, helpers) ?? helpers.createNode("paragraph", undefined, helpers.parseInline(token.tokens ?? []));
    } }),
    Markdown, TableKit.configure({ table: { resizable: true, allowTableNodeSelection: true, View: markdownTableView(labels) } }),
    Image.extend({ addNodeView: () => markdownImageView(inspect) }).configure({ inline: true }),
    TaskList, TaskItem.configure({ nested: true, HTMLAttributes: { "data-type": "taskItem" }, a11y: { checkboxLabel: (node) => `${labels.rich.taskList}: ${node.textContent}` } }),
    InlineMath.configure({ katexOptions: { throwOnError: false, displayMode: false }, onClick: (node, position) => inspect({ kind: "math", value: node.attrs.latex, inline: true, position }) }),
    BlockMath.configure({ katexOptions: { throwOnError: false, displayMode: true }, onClick: (node, position) => inspect({ kind: "math", value: node.attrs.latex, inline: false, position }) }),
    CodeBlockLowlight.extend({ addNodeView: () => markdownCodeView(labels) }).configure({ lowlight, defaultLanguage: "plaintext" }),
    RawMarkdownBlock, RawHtmlBlock, RawMarkdownInline, RawMarkdownDefinition, Search,
  ];
}
