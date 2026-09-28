import { createRoot, type Root } from "react-dom/client";
import type { NodeViewRenderer, NodeViewRendererProps } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import type { ViewMutationRecord } from "@tiptap/pm/view";
import { closeHistory } from "@tiptap/pm/history";
import { ChatMermaidDiagram } from "@nextclaw/agent-chat-ui";
import { Pencil, Eye } from "lucide-react";
import { IconButton } from "../icon-button";
import { CopyButton } from "../copy-button";
import type { MarkdownEditorLabels, MarkdownInspector } from "../../types/markdown-editor.types";

class MarkdownCodeNodeView {
  readonly dom: HTMLElement;
  readonly contentDOM: HTMLElement;
  private readonly toolbar: HTMLElement;
  private readonly toolbarRoot: Root;
  private readonly pre: HTMLElement;
  private readonly preview: HTMLElement;
  private previewRoot?: Root;
  private timer?: ReturnType<typeof setTimeout>;
  private editingDiagram = false;
  private node: Node;
  constructor(private readonly context: NodeViewRendererProps, private readonly labels: MarkdownEditorLabels) {
    this.node = context.node;
    this.dom = document.createElement("section");
    this.dom.className = "ui-rich-code-block";
    this.toolbar = document.createElement("div");
    this.toolbar.className = "ui-rich-code-toolbar";
    this.toolbar.contentEditable = "false";
    this.toolbarRoot = createRoot(this.toolbar);
    this.pre = document.createElement("pre");
    this.contentDOM = document.createElement("code");
    this.pre.append(this.contentDOM);
    this.preview = document.createElement("div");
    this.preview.className = "ui-rich-diagram-preview";
    this.preview.contentEditable = "false";
    this.dom.append(this.toolbar, this.pre, this.preview);
    this.render();
  }
  private render = () => {
    const diagram = String(this.node.attrs.language).toLowerCase() === "mermaid";
    this.toolbarRoot.render(<>
      <input aria-label={this.labels.rich.language} placeholder={this.labels.rich.language} value={String(this.node.attrs.language ?? "plaintext")} onChange={event => {
        const position = this.context.getPos(); if (position !== undefined) this.context.editor.view.dispatch(this.context.editor.state.tr.setNodeMarkup(position, undefined, { ...this.node.attrs, language: event.target.value }));
        this.render();
      }} />
      {diagram && <IconButton label={this.editingDiagram ? this.labels.rich.preview : this.labels.rich.edit} icon={this.editingDiagram ? <Eye /> : <Pencil />} onClick={() => {
        this.editingDiagram = !this.editingDiagram; this.render();
        if (this.editingDiagram) { const position = this.context.getPos(); if (position !== undefined) { this.context.editor.commands.setTextSelection(position + 1); this.context.editor.view.focus(); } }
      }} />}
      <CopyButton text={this.node.textContent} label={this.labels.rich.copy} copiedLabel={this.labels.rich.confirm} failedLabel={this.labels.rich.error} />
    </>);
    this.pre.hidden = diagram && !this.editingDiagram;
    this.preview.hidden = !diagram || this.editingDiagram;
    if (!diagram) return;
    this.previewRoot ??= createRoot(this.preview);
    this.previewRoot.render(<ChatMermaidDiagram source={this.node.textContent} texts={{ copyCodeLabel: this.labels.rich.copy, copiedCodeLabel: this.labels.rich.confirm, mermaidLoadingLabel: this.labels.rich.loading, mermaidRenderErrorLabel: this.labels.rich.error, mermaidDiagramLabel: this.labels.rich.preview }} isStreaming={false} showToolbar={false} />);
  };
  update = (next: Node) => {
    if (next.type !== this.node.type) return false;
    const changed = next.textContent !== this.node.textContent || next.attrs.language !== this.node.attrs.language;
    this.node = next;
    if (changed) { clearTimeout(this.timer); this.timer = setTimeout(this.render, 180); }
    return true;
  };
  stopEvent = (event: Event) => this.toolbar.contains(event.target as globalThis.Node) || this.preview.contains(event.target as globalThis.Node);
  ignoreMutation = (mutation: ViewMutationRecord) => mutation.type !== "selection" && !this.contentDOM.contains(mutation.target);
  destroy = () => { clearTimeout(this.timer); queueMicrotask(() => { this.toolbarRoot.unmount(); this.previewRoot?.unmount(); }); };
}

export function markdownCodeView(labels: MarkdownEditorLabels): NodeViewRenderer {
  return context => new MarkdownCodeNodeView(context, labels);
}

class MarkdownImageNodeView {
  readonly dom = document.createElement("span");
  private readonly image = document.createElement("img");
  private node: Node;
  constructor(context: NodeViewRendererProps, inspect: (value: MarkdownInspector) => void) {
    this.node = context.node;
    this.dom.className = "ui-rich-image";
    this.image.addEventListener("click", event => {
      const position = context.getPos();
      if (position === undefined) return;
      event.preventDefault(); event.stopPropagation();
      context.editor.view.dispatch(closeHistory(context.editor.state.tr));
      context.editor.commands.setNodeSelection(position); context.editor.view.focus();
    });
    this.image.addEventListener("dblclick", event => {
      const position = context.getPos();
      if (position !== undefined) { event.preventDefault(); inspect({ kind: "image", value: this.node.attrs.src, position }); }
    });
    this.render(); this.dom.append(this.image);
  }
  private render = () => { this.image.src = this.node.attrs.src; this.image.alt = this.node.attrs.alt ?? ""; this.image.title = this.node.attrs.title ?? ""; };
  update = (next: Node) => { if (next.type !== this.node.type) return false; this.node = next; this.render(); return true; };
  selectNode = () => { this.dom.classList.add("ProseMirror-selectednode"); };
  deselectNode = () => { this.dom.classList.remove("ProseMirror-selectednode"); };
  ignoreMutation = () => true;
}

export function markdownImageView(inspect: (value: MarkdownInspector) => void): NodeViewRenderer {
  return context => new MarkdownImageNodeView(context, inspect);
}
