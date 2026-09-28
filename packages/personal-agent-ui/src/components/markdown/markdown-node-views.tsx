import { createRoot, type Root } from "react-dom/client";
import type { NodeViewRenderer } from "@tiptap/core";
import { ChatMermaidDiagram } from "@nextclaw/agent-chat-ui";
import type { MarkdownEditorLabels } from "../../types/markdown-editor.types";

/** ProseMirror alone owns the editable DOM; React owns only the diagram preview. */
export function markdownCodeView(labels: MarkdownEditorLabels): NodeViewRenderer {
  return ({ node: initial, editor, getPos }) => {
    let node = initial;
    const dom = document.createElement("section");
    dom.className = "ui-rich-code-block";
    const toolbar = document.createElement("div");
    toolbar.className = "ui-rich-code-toolbar";
    toolbar.contentEditable = "false";
    const language = document.createElement("input");
    language.value = String(node.attrs.language ?? "plaintext");
    language.setAttribute("aria-label", labels.rich.language);
    language.placeholder = labels.rich.language;
    const change = () => { const position = getPos(); if (position !== undefined) editor.view.dispatch(editor.state.tr.setNodeMarkup(position, undefined, { ...node.attrs, language: language.value.trim() || "plaintext" })); };
    language.addEventListener("input", change);
    const copy = document.createElement("button");
    copy.type = "button"; copy.textContent = labels.rich.copy;
    copy.addEventListener("click", () => { void navigator.clipboard.writeText(node.textContent).then(() => { copy.textContent = labels.rich.confirm; }).catch(() => { copy.textContent = labels.rich.error; }); });
    toolbar.append(language, copy);
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    pre.append(code);
    const preview = document.createElement("div");
    preview.className = "ui-rich-diagram-preview";
    preview.contentEditable = "false";
    let previewRoot: Root | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const render = () => {
      const diagram = String(node.attrs.language).toLowerCase() === "mermaid";
      preview.hidden = !diagram;
      if (!diagram) return;
      previewRoot ??= createRoot(preview);
      previewRoot.render(<ChatMermaidDiagram source={node.textContent} texts={{ copyCodeLabel: labels.rich.copy, copiedCodeLabel: labels.rich.confirm, mermaidLoadingLabel: labels.rich.loading, mermaidRenderErrorLabel: labels.rich.error, mermaidDiagramLabel: labels.rich.preview }} isStreaming={false} showToolbar={false} />);
    };
    dom.append(toolbar, pre, preview);
    render();
    return {
      dom, contentDOM: code,
      update(next) {
        if (next.type !== node.type) return false;
        const changed = next.textContent !== node.textContent || next.attrs.language !== node.attrs.language;
        node = next;
        if (document.activeElement !== language) language.value = String(node.attrs.language ?? "plaintext");
        if (changed) { clearTimeout(timer); timer = setTimeout(render, 180); }
        return true;
      },
      stopEvent: (event) => toolbar.contains(event.target as globalThis.Node) || preview.contains(event.target as globalThis.Node),
      ignoreMutation: (mutation) => mutation.type !== "selection" && !code.contains(mutation.target),
      destroy: () => { clearTimeout(timer); const root = previewRoot; if (root) queueMicrotask(() => root.unmount()); },
    };
  };
}
