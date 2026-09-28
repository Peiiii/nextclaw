import { Extension, getSchema, type Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Paragraph from "@tiptap/extension-paragraph";
import { Markdown } from "@tiptap/markdown";
import { Table, TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { search } from "prosemirror-search";
import { RawMarkdownBlock, RawHtmlBlock, RawMarkdownInline, RawMarkdownDefinition } from "../utils/markdown-preservation.utils";
import { needsRichTable, renderRichHtml, parseRichHtml } from "../utils/markdown-rich-html.utils";
import { markdownStructureExtensions } from "./markdown-structure.config";
import { parseMarkdownImageHtml, renderMarkdownImage } from "../utils/markdown-image.utils";
import { markdownCodeView, markdownImageView } from "../components/markdown/markdown-node-views";
import { markdownTableView } from "../components/markdown/markdown-table-view";
import type { MarkdownEditorLabels, MarkdownInspector } from "../types/markdown-editor.types";

const lowlight = createLowlight(common);
const Search = Extension.create({ name: "documentSearch", addProseMirrorPlugins: () => [search()] });

export function markdownEditorExtensions(labels: MarkdownEditorLabels, inspect: (value: MarkdownInspector) => void) {
  let schema: ReturnType<typeof getSchema> | undefined;
  const richSchema = () => schema ??= getSchema(extensions);
  const extensions: Extensions = [
    StarterKit.configure({ codeBlock: false, paragraph: false, blockquote: false, underline: false, link: { openOnClick: false, autolink: false } }),
    ...markdownStructureExtensions(richSchema, labels),
    Paragraph.extend({ parseMarkdown: (token, helpers) => {
      // The upstream paragraph parser unwraps standalone images as block nodes.
      // Our images are inline, so their paragraph must remain in the document.
      if (token.tokens?.length === 1 && token.tokens[0].type === "image") return helpers.createNode("paragraph", undefined, helpers.parseInline(token.tokens));
      return Paragraph.config.parseMarkdown?.call(Paragraph, token, helpers) ?? helpers.createNode("paragraph", undefined, helpers.parseInline(token.tokens ?? []));
    } }),
    Markdown, TableKit.configure({ table: false }),
    Table.extend({ renderMarkdown: (node, helpers, context) => {
      return needsRichTable(node) ? renderRichHtml(node, richSchema()) : Table.config.renderMarkdown!.call(Table, node, helpers, context);
    } }).configure({ resizable: true, allowTableNodeSelection: true, View: markdownTableView(labels) }),
    Image.extend({ addNodeView: () => markdownImageView(inspect, labels), renderMarkdown: renderMarkdownImage }).configure({ inline: true }),
    TaskList, TaskItem.configure({ nested: true, HTMLAttributes: { "data-type": "taskItem" }, a11y: { checkboxLabel: (node) => `${labels.rich.taskList}: ${node.textContent}` } }),
    InlineMath.configure({ katexOptions: { throwOnError: false, displayMode: false }, onClick: (node, position) => inspect({ kind: "math", value: node.attrs.latex, inline: true, position }) }),
    BlockMath.configure({ katexOptions: { throwOnError: false, displayMode: true }, onClick: (node, position) => inspect({ kind: "math", value: node.attrs.latex, inline: false, position }) }),
    CodeBlockLowlight.extend({ addNodeView: () => markdownCodeView(labels) }).configure({ lowlight, defaultLanguage: "plaintext" }),
    RawMarkdownBlock, RawHtmlBlock.extend({ parseMarkdown: (token, helpers) => {
      const image = parseMarkdownImageHtml(token.raw ?? token.text ?? "");
      if (image) return helpers.createNode("paragraph", undefined, [image]);
      return parseRichHtml(token.raw ?? token.text ?? "", richSchema()) ?? RawHtmlBlock.config.parseMarkdown!.call(RawHtmlBlock, token, helpers);
    } }), RawMarkdownInline.extend({ parseMarkdown: (token, helpers) => {
      return parseMarkdownImageHtml(token.raw ?? "") ?? RawMarkdownInline.config.parseMarkdown!.call(RawMarkdownInline, token, helpers);
    } }), RawMarkdownDefinition, Search,
  ];
  return extensions;
}
