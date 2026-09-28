import type { JSONContent } from "@tiptap/core";

export function parseMarkdownImageHtml(raw: string): JSONContent | null {
  if (!/^\s*<img\b/i.test(raw)) return null;
  const body = new DOMParser().parseFromString(raw, "text/html").body;
  const image = body.firstElementChild;
  if (body.children.length !== 1 || image?.tagName !== "IMG" || body.textContent?.trim()) return null;
  if (Array.from(image.attributes).some(attribute => !["src", "alt", "title", "width", "height"].includes(attribute.name))) return null;
  const size = (name: string) => { const value = Number(image.getAttribute(name)); return Number.isFinite(value) && value > 0 ? value : null; };
  return { type: "image", attrs: { src: image.getAttribute("src"), alt: image.getAttribute("alt"), title: image.getAttribute("title"), width: size("width"), height: size("height") } };
}

export function renderMarkdownImage(node: JSONContent): string {
  const { src = "", alt = "", title = "", width, height } = node.attrs ?? {};
  if (width || height) {
    const image = document.createElement("img");
    image.setAttribute("src", String(src)); image.setAttribute("alt", String(alt));
    if (title) image.setAttribute("title", String(title));
    if (width) image.setAttribute("width", String(width));
    if (height) image.setAttribute("height", String(height));
    return image.outerHTML;
  }
  const label = String(alt).replace(/[\\\[\]]/g, "\\$&");
  const caption = title ? ` "${String(title).replace(/[\\"]/g, "\\$&")}"` : "";
  const url = /[\s()]/.test(String(src)) ? `<${String(src).replace(/>/g, "%3E")}>` : src;
  return `![${label}](${url}${caption})`;
}
