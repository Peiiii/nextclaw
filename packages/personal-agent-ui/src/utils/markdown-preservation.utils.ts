import { Node } from "@tiptap/core";

// Preserve Markdown constructs the rich schema cannot faithfully represent.
// Raw content is text, never executable HTML.
export const RawMarkdownBlock = Node.create({
  name: "rawMarkdownBlock", group: "block", content: "text*", code: true, marks: "", defining: true,
  parseHTML: () => [{ tag: "pre[data-raw-markdown]", preserveWhitespace: "full" }],
  renderHTML: () => ["pre", { "data-raw-markdown": "true", class: "ui-markdown-metadata" }, ["code", 0]],
  markdownTokenizer: {
    name: "rawMarkdownBlock", level: "block",
    start: (source) => /^(?:---\s*$|\[\^[^\]]+\]:|<!--)/m.exec(source)?.index ?? -1,
    tokenize: (source, tokens) => {
      const match = (tokens.length === 0 ? /^---[ \t]*\n[\s\S]*?\n---[ \t]*(?:\n|$)/.exec(source) : null)
        || /^\[\^[^\]]+\]:[^\n]*(?:\n(?:[ \t]+[^\n]*|\n(?=[ \t]+)))*/.exec(source)
        || /^<!--[\s\S]*?-->/.exec(source);
      return match ? { type: "rawMarkdownBlock", raw: match[0], text: match[0].trimEnd() } : undefined;
    },
  },
  parseMarkdown: (token) => ({ type: "rawMarkdownBlock", content: token.text ? [{ type: "text", text: token.text }] : [] }),
  renderMarkdown: (node) => (node.content ?? []).map((child) => child.text ?? "").join(""),
});

export const RawHtmlBlock = RawMarkdownBlock.extend({
  name: "rawHtmlBlock", markdownTokenName: "html", markdownTokenizer: undefined,
  parseHTML: () => [{ tag: "pre[data-raw-html]", preserveWhitespace: "full" }],
  parseMarkdown: (token) => ({ type: "rawHtmlBlock", content: [{ type: "text", text: token.raw ?? token.text ?? "" }] }),
  renderHTML: () => ["pre", { "data-raw-html": "true", class: "ui-markdown-metadata" }, ["code", 0]],
});

export const RawMarkdownDefinition = RawMarkdownBlock.extend({
  name: "rawMarkdownDefinition", markdownTokenName: "def", markdownTokenizer: undefined,
  parseMarkdown: (token) => ({ type: "rawMarkdownDefinition", content: [{ type: "text", text: token.raw ?? "" }] }),
});

export const RawMarkdownInline = Node.create({
  name: "rawMarkdownInline", group: "inline", inline: true, atom: true,
  addAttributes: () => ({ raw: { default: "" } }),
  parseHTML: () => [{ tag: "span[data-raw-inline]", getAttrs: (element) => ({ raw: element.textContent }) }],
  renderHTML: ({ node }) => ["span", { "data-raw-inline": "true", class: "ui-markdown-raw-inline" }, node.attrs.raw],
  markdownTokenizer: {
    name: "rawMarkdownInline", level: "inline",
    start: (source) => /\[\^|</.exec(source)?.index ?? -1,
    tokenize: (source) => {
      if (/^<(u|mark)>[\s\S]*?<\/\1>/.test(source)) return undefined;
      const match = /^\[\^[^\]]+\]/.exec(source) || /^<!--[\s\S]*?-->/.exec(source) || /^<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^>]*|\s*\/?)>/.exec(source);
      return match ? { type: "rawMarkdownInline", raw: match[0] } : undefined;
    },
  },
  parseMarkdown: (token) => ({ type: "rawMarkdownInline", attrs: { raw: token.raw } }),
  renderMarkdown: (node) => node.attrs?.raw ?? "",
});
