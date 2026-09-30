import type { Editor } from "@tiptap/core";
import { DragHandlePlugin, normalizeNestedOptions } from "@tiptap/extension-drag-handle";
import { closeHistory } from "@tiptap/pm/history";
import { NodeSelection, TextSelection, type Transaction } from "@tiptap/pm/state";
import type { MarkdownAnchor, MarkdownInspector } from "../types/markdown-editor.types";

export type MarkdownBlockState = { position: number; kind: string; anchor: MarkdownAnchor; open: boolean; convertible: boolean };
export type MarkdownBlockFormat = "paragraph" | "h1" | "h2" | "h3" | "codeBlock" | "quote" | "callout" | "toggle" | "list" | "orderedList" | "taskList";
export type MarkdownBlockAction = "duplicate" | "delete" | "before" | "after" | "edit" | "copy";

/** One transient block target; document content and history stay in ProseMirror. */
export class MarkdownBlockManager {
  private editor?: Editor;
  element?: HTMLDivElement;
  private resize?: ResizeObserver;
  private state: MarkdownBlockState | null = null;
  constructor(private readonly changed: (state: MarkdownBlockState | null) => void,
    private readonly inspect: (value: MarkdownInspector) => void) {}

  bind = (editor: Editor) => {
    this.editor = editor;
    this.element = document.createElement("div");
    this.element.className = "ui-markdown-block-handle";
    const { plugin } = DragHandlePlugin({ editor, element: this.element,
      computePositionConfig: { placement: "left", strategy: "absolute" },
      getReferencedVirtualElement: () => {
        const anchor = this.state?.anchor;
        return anchor ? { getBoundingClientRect: () => new DOMRect(anchor.x + 30, anchor.y, 0, anchor.height) } : null;
      },
      nestedOptions: normalizeNestedOptions({ edgeDetection: "none", rules: [{ id: "document-blocks", evaluate: ({ $pos, node, depth }) => {
        for (let ancestor = 1; ancestor < depth; ancestor++) {
          if (["table", "blockquote"].includes($pos.node(ancestor).type.name)) return 1000;
        }
        return ["bulletList", "orderedList", "taskList", "detailsSummary", "detailsContent"].includes(node.type.name) ? 1000 : 0;
      } }] }),
      onNodeChange: ({ node, pos }) => { if (!this.state?.open) { if (node) this.target(pos); else this.clear(); } },
    });
    editor.registerPlugin(plugin);
    let width = editor.view.dom.clientWidth;
    this.resize = new ResizeObserver(() => {
      const next = editor.view.dom.clientWidth;
      if (next === width) return;
      width = next;
      this.close();
      editor.view.dom.dispatchEvent(new MouseEvent("mouseleave"));
    });
    this.resize.observe(editor.view.dom);
  };
  update = (transaction: Transaction) => {
    const editor = this.editor;
    if (!editor) return;
    if (this.state?.open) {
      const mapped = transaction.mapping.mapResult(this.state.position, 1);
      if (mapped.deleted) { this.clear(); return; }
      this.target(mapped.pos, true);
    }
  };
  refresh = () => {
    const editor = this.editor, state = this.state;
    if (!editor || !state) return;
    const block = editor.view.nodeDOM(state.position), viewport = editor.view.dom.closest(".ui-rich-markdown-scroll")?.getBoundingClientRect();
    if (block instanceof HTMLElement && viewport) {
      const box = block.getBoundingClientRect();
      if (state.open && (box.top < viewport.top || box.top > viewport.bottom)) this.close();
    }
    this.target(state.position, this.state?.open);
  };
  reveal = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" && !this.state?.open) this.editor?.view.dom.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: event.clientX, clientY: event.clientY }));
  };
  private target = (position: number, open = false) => {
    const editor = this.editor, node = editor?.state.doc.nodeAt(position);
    if (!editor || !node || !node.isBlock) return;
    const element = editor.view.nodeDOM(position);
    if (!(element instanceof HTMLElement)) return;
    const firstLine = element.matches("p,h1,h2,h3,h4,h5,h6") ? element : element.querySelector<HTMLElement>("p,h1,h2,h3,h4,h5,h6,summary") ?? element;
    const box = firstLine.getBoundingClientRect();
    const style = getComputedStyle(firstLine);
    const height = Math.min(box.height, parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.85);
    const list = element.closest("li")?.parentElement;
    const left = list?.matches("ul,ol") ? list.getBoundingClientRect().left : box.left;
    const kind = node.type.name === "paragraph" && node.childCount === 1 && node.firstChild?.type.name === "image" ? "image" : node.type.name;
    const anchor = { x: left - 30, y: box.top, width: 20, height };
    let convertible = ["paragraph", "heading", "codeBlock"].includes(kind);
    node.forEach(child => { if (!child.isText && child.type.name !== "hardBreak") convertible = false; });
    const next = { position, kind, anchor, open, convertible };
    if (JSON.stringify(next) !== JSON.stringify(this.state)) { this.state = next; this.changed(next); }
  };
  open = () => {
    const editor = this.editor, state = this.state;
    if (!editor || !state) return;
    this.target(state.position, true);
    const position = state.kind === "image" ? state.position + 1 : state.position;
    editor.view.dispatch(editor.state.tr.setMeta("lockDragHandle", true).setSelection(NodeSelection.create(editor.state.doc, position)));
  };
  close = () => { if (this.state) { this.state = { ...this.state, open: false }; this.changed(this.state); this.editor?.commands.setMeta("lockDragHandle", false); } };
  clear = () => {
    const locked = this.state?.open;
    this.state = null; this.changed(null);
    if (locked) this.editor?.commands.setMeta("lockDragHandle", false);
  };
  focus = () => { if (this.editor && !this.editor.view.hasFocus()) this.editor.view.focus(); };
  targetSelection = () => {
    const editor = this.editor;
    if (!editor) return;
    const selection = editor.state.selection;
    if (selection instanceof NodeSelection && selection.node.isBlock) { this.target(selection.from); return; }
    const position = selection.$from;
    let depth = 1;
    for (let index = 1; index <= position.depth; index++) {
      const kind = position.node(index).type.name;
      if (["listItem", "taskItem"].includes(kind)) depth = index;
      if (["table", "blockquote"].includes(kind)) break;
    }
    if (position.depth) this.target(position.before(depth));
    else this.clear();
  };
  key = (event: KeyboardEvent) => {
    const editor = this.editor;
    if (!editor || editor.view.composing || event.isComposing) return false;
    const selection = editor.state.selection;
    if (event.key === "Escape" && !(selection instanceof NodeSelection)) {
      this.targetSelection();
      if (!this.state) return false;
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, this.state.position)));
    } else if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && selection instanceof NodeSelection) {
      if (selection.node.isTextblock || ["listItem", "taskItem", "blockquote", "details"].includes(selection.node.type.name)) {
        editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(selection.from + 1))));
      } else { this.targetSelection(); void this.perform("after"); }
    } else if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "d") {
      this.targetSelection(); void this.perform("duplicate");
    } else if (event.altKey && event.shiftKey && ["ArrowUp", "ArrowDown"].includes(event.key)) {
      this.targetSelection(); this.move(event.key === "ArrowUp" ? -1 : 1);
    } else return false;
    event.preventDefault(); return true;
  };
  private move = (direction: -1 | 1) => {
    const editor = this.editor, state = this.state;
    if (!editor || !state) return;
    const position = editor.state.doc.resolve(state.position), node = editor.state.doc.nodeAt(state.position);
    const siblingIndex = position.index() + direction;
    if (!node || siblingIndex < 0 || siblingIndex >= position.parent.childCount) return;
    const sibling = position.parent.child(siblingIndex);
    const destination = state.position + (direction < 0 ? -sibling.nodeSize : sibling.nodeSize);
    const transaction = closeHistory(editor.state.tr).delete(state.position, state.position + node.nodeSize).insert(destination, node);
    editor.view.dispatch(transaction.setSelection(NodeSelection.create(transaction.doc, destination)).scrollIntoView());
    editor.view.dispatch(closeHistory(editor.state.tr));
  };
  openAtSelection = () => {
    this.targetSelection(); this.open();
  };
  destroy = () => { this.resize?.disconnect(); };
  convert = (format: MarkdownBlockFormat) => {
    const editor = this.editor, state = this.state;
    if (!editor || !state?.convertible) return;
    this.close();
    editor.view.dispatch(closeHistory(editor.state.tr).setSelection(NodeSelection.create(editor.state.doc, state.position)));
    const chain = editor.chain();
    if (format === "paragraph") chain.setParagraph().run();
    else if (format === "codeBlock") chain.setCodeBlock().run();
    else if (format === "quote") chain.toggleBlockquote().run();
    else if (format === "callout") chain.setBlockquote().updateAttributes("blockquote", { callout: "note" }).run();
    else if (format === "toggle") chain.setDetails().updateAttributes("details", { open: true }).run();
    else if (format === "list") chain.toggleBulletList().run();
    else if (format === "orderedList") chain.toggleOrderedList().run();
    else if (format === "taskList") chain.toggleTaskList().run();
    else chain.setHeading({ level: Number(format.slice(1)) as 1 | 2 | 3 }).run();
    editor.view.dispatch(closeHistory(editor.state.tr));
    this.focus();
  };
  perform = async (action: MarkdownBlockAction) => {
    const editor = this.editor, state = this.state;
    if (!editor || !state) return;
    const node = editor.state.doc.nodeAt(state.position);
    if (!node) return;
    if (action === "copy") { await navigator.clipboard.writeText(node.textContent); return; }
    this.close();
    if (action === "edit") {
      const target = state.kind === "image" ? node.firstChild : node;
      if (target) this.inspect({ kind: state.kind === "image" ? "image" : "math", value: String(target.attrs.src ?? target.attrs.latex ?? ""), position: state.position + (state.kind === "image" ? 1 : 0), inline: false });
      return;
    }
    const transaction = closeHistory(editor.state.tr), end = state.position + node.nodeSize;
    if (action === "delete") {
      const resolved = editor.state.doc.resolve(state.position);
      const onlyListItem = ["listItem", "taskItem"].includes(node.type.name) && resolved.parent.childCount === 1;
      transaction.delete(onlyListItem ? resolved.before() : state.position, onlyListItem ? resolved.after() : end);
    }
    else if (action === "duplicate") transaction.insert(end, node).setSelection(NodeSelection.create(transaction.doc, end));
    else {
      const position = action === "before" ? state.position : end;
      const paragraph = editor.schema.nodes.paragraph.create();
      const sibling = ["listItem", "taskItem"].includes(node.type.name) ? node.type.create(node.type.name === "taskItem" ? { checked: false } : null, paragraph) : paragraph;
      transaction.insert(position, sibling).setSelection(TextSelection.create(transaction.doc, position + (sibling === paragraph ? 1 : 2)));
    }
    editor.view.dispatch(transaction.scrollIntoView());
    editor.view.dispatch(closeHistory(editor.state.tr));
    this.focus();
  };
}
