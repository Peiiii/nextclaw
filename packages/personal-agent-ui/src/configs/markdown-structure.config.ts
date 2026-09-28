import type { MarkConfig, JSONContent } from "@tiptap/core";
import Blockquote from "@tiptap/extension-blockquote";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import type { Schema } from "@tiptap/pm/model";
import { renderRichHtml } from "../utils/markdown-rich-html.utils";
import type { MarkdownEditorLabels } from "../types/markdown-editor.types";

function htmlMark(name: "underline" | "highlight", tag: "u" | "mark"): Partial<MarkConfig> {
  return {
    renderMarkdown: (node, helpers) => `<${tag}>${helpers.renderChildren(node)}</${tag}>`,
    parseMarkdown: (token, helpers) => helpers.applyMark(name, helpers.parseInline(token.tokens ?? [])),
    markdownTokenizer: { name, level: "inline", start: source => source.indexOf(`<${tag}>`),
      tokenize: (source, _tokens, lexer) => {
        const match = new RegExp(`^<${tag}>([\\s\\S]*?)</${tag}>`).exec(source);
        return match ? { type: name, raw: match[0], tokens: lexer.inlineTokens(match[1]) } : undefined;
      },
    },
  };
}

const Callout = Blockquote.extend({
  addAttributes: () => ({ callout: { default: null, parseHTML: element => element.getAttribute("data-callout"), renderHTML: attrs => attrs.callout ? { "data-callout": attrs.callout } : {} } }),
  parseMarkdown: (token, helpers) => {
    const content = (helpers.parseBlockChildren ?? helpers.parseChildren)(token.tokens ?? []) as JSONContent[];
    const first = content[0]?.content?.[0];
    const marker = first?.type === "text" && /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\n|$)/.exec(first.text ?? "");
    if (marker) { first!.text = first!.text!.slice(marker[0].length); if (!first!.text) content[0].content!.shift(); }
    return helpers.createNode("blockquote", marker ? { callout: marker[1].toLowerCase() } : undefined, content);
  },
  renderMarkdown: (node, helpers, context) => {
    const quote = Blockquote.config.renderMarkdown!.call(Blockquote, node, helpers, context);
    return node.attrs?.callout ? `> [!${String(node.attrs.callout).toUpperCase()}]\n${quote}` : quote;
  },
});

export function markdownStructureExtensions(schema: () => Schema, labels: MarkdownEditorLabels) {
  return [
    Underline.extend(htmlMark("underline", "u")), Highlight.extend(htmlMark("highlight", "mark")), Callout,
    Details.extend({ renderMarkdown: node => renderRichHtml(node, schema()), markdownTokenizer: undefined }).configure({
      persist: true,
      renderToggleButton: ({ element, isOpen }) => { element.textContent = ""; element.setAttribute("aria-label", labels.rich.toggleContent); element.setAttribute("aria-expanded", String(isOpen)); },
    }), DetailsSummary, DetailsContent,
  ];
}
