import type { JSONContent } from "@tiptap/core";
import { DOMParser as ProseMirrorDOMParser, DOMSerializer, type Schema } from "@tiptap/pm/model";

/** GFM cannot retain widths, merged cells, arbitrary headers or block content. */
export function needsRichTable(node: JSONContent): boolean {
  const alignments = node.content?.[0]?.content?.map(cell => cell.attrs?.align ?? null) ?? [];
  return (node.content ?? []).some((row, rowIndex) => (row.content ?? []).some((cell, column) =>
    cell.attrs?.colwidth?.some((width: number) => width > 0) || cell.attrs?.colspan > 1 || cell.attrs?.rowspan > 1
    || cell.type !== (rowIndex === 0 ? "tableHeader" : "tableCell")
    || (cell.attrs?.align ?? null) !== alignments[column]
    || cell.content?.length !== 1 || cell.content[0]?.type !== "paragraph"));
}

export function renderRichHtml(node: JSONContent, schema: Schema): string {
  const container = document.createElement("div");
  container.append(DOMSerializer.fromSchema(schema).serializeNode(schema.nodeFromJSON(node)));
  // Standard width attributes survive the reader's sanitizer; arbitrary styles do not.
  for (const element of Array.from(container.querySelectorAll<HTMLElement>("[style]"))) {
    const width = element.style.width;
    if (/^\d+(?:\.\d+)?px$/.test(width)) element.setAttribute("width", String(Number.parseFloat(width)));
    if (["left", "center", "right"].includes(element.style.textAlign)) element.setAttribute("align", element.style.textAlign);
    element.removeAttribute("style");
  }
  for (const math of Array.from(container.querySelectorAll("[data-type=inline-math],[data-type=block-math]"))) {
    const code = document.createElement("code");
    code.className = math.getAttribute("data-type") === "block-math" ? "math-display" : "math-inline";
    code.textContent = math.getAttribute("data-latex") ?? "";
    if (code.className === "math-display") { const pre = document.createElement("pre"); pre.append(code); math.replaceWith(pre); }
    else math.replaceWith(code);
  }
  return container.innerHTML;
}

export function parseRichHtml(html: string, schema: Schema): JSONContent[] | null {
  const root = /^\s*<(table|details)[\s>]/i.exec(html)?.[1].toLowerCase();
  if (!root) return null;
  const document = new DOMParser().parseFromString(html, "text/html");
  if (document.body.children.length !== 1 || document.body.firstElementChild?.tagName.toLowerCase() !== root) return null;
  const tags = new Set("TABLE TBODY THEAD TFOOT TR TD TH COLGROUP COL P BR STRONG B EM I S DEL U MARK CODE PRE BLOCKQUOTE UL OL LI A IMG SPAN DIV INPUT LABEL H1 H2 H3 H4 H5 H6 HR DETAILS SUMMARY".split(" "));
  const attributes = new Set("title width height start checked disabled type colspan rowspan align href src alt style class data-type data-latex data-colwidth colwidth data-checked data-callout open target rel".split(" "));
  for (const element of Array.from(document.body.querySelectorAll("*"))) {
    if (!tags.has(element.tagName) || Array.from(element.attributes).some(attribute => !attributes.has(attribute.name))) return null;
    // Unknown styling must stay raw rather than silently disappearing after an unrelated edit.
    if (Array.from((element as HTMLElement).style).some(property => !["width", "min-width", "text-align"].includes(property))) return null;
    if (Array.from(element.classList).some(value => !/^(language-\S+|math-inline|math-display)$/.test(value))) return null;
  }
  for (const details of Array.from(document.querySelectorAll("details"))) {
    if (details.querySelector(":scope > div[data-type=detailsContent]")) continue;
    const content = document.createElement("div");
    content.setAttribute("data-type", "detailsContent");
    for (const child of Array.from(details.childNodes)) if (!(child instanceof Element && child.tagName === "SUMMARY")) content.append(child);
    details.append(content);
  }
  for (const code of Array.from(document.querySelectorAll("code.math-inline,code.math-display"))) {
    const block = code.classList.contains("math-display");
    const math = document.createElement(block ? "div" : "span");
    math.setAttribute("data-type", block ? "block-math" : "inline-math");
    math.setAttribute("data-latex", code.textContent ?? "");
    (block && code.parentElement?.tagName === "PRE" ? code.parentElement : code).replaceWith(math);
  }
  const parsed = ProseMirrorDOMParser.fromSchema(schema).parse(document.body).toJSON() as JSONContent;
  return parsed.content?.length === 1 && parsed.content[0].type === root ? parsed.content : null;
}
