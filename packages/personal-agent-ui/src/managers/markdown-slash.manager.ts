import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { markdownCommandItems } from "../configs/markdown-commands.config";
import type { MarkdownEditorLabels, MarkdownSlashItem, MarkdownSlashState } from "../types/markdown-editor.types";

/** A session starts from typing '/' or explicit insertion, never from selection or pasted text. */
export class MarkdownSlashManager {
  private start?: number;
  private state: MarkdownSlashState | null = null;
  private items: MarkdownSlashItem[] = [];
  constructor(labels: MarkdownEditorLabels, private readonly changed: (state: MarkdownSlashState | null) => void,
    private readonly execute: (item: MarkdownSlashItem) => void) {
    this.updateLabels(labels);
  }
  updateLabels = (labels: MarkdownEditorLabels) => {
    this.items = markdownCommandItems(labels);
    if (this.state) {
      this.state = { ...this.state, items: this.state.items.map(item => this.items.find(candidate => candidate.id === item.id) ?? item) };
      this.changed(this.state);
    }
  }
  input = (editor: Editor, from: number, text: string) => {
    if (text === "/" && !editor.view.composing && editor.state.selection.empty) {
      const position = editor.state.doc.resolve(from);
      if (position.parent.type.name === "paragraph" && position.parentOffset === 0) this.start = from;
    }
    return false;
  }
  open = (editor: Editor) => {
    const selection = editor.state.selection;
    if (!selection.empty || selection.$from.parent.type.name !== "paragraph" || selection.$from.parent.content.size) return;
    this.start = selection.from;
    editor.view.dispatch(editor.state.tr.insertText("/"));
    editor.view.focus();
  };
  update = (editor: Editor, transaction: Transaction) => {
    if (this.start === undefined) return;
    this.start = transaction.mapping.map(this.start, -1);
    const { from, empty, $from } = editor.state.selection;
    if (!empty || from <= this.start || $from.parent.type.name !== "paragraph" || this.start < $from.start()) return this.close();
    const text = editor.state.doc.textBetween(this.start, from);
    if (!text.startsWith("/") || /\s/.test(text)) return this.close();
    const query = text.slice(1).toLowerCase();
    const items = this.items.filter(item => `${item.id} ${item.label} ${item.keywords}`.toLowerCase().includes(query));
    const coords = editor.view.coordsAtPos(this.start);
    const previous = this.state?.items[this.state.index]?.id;
    const index = Math.max(0, items.findIndex(item => item.id === previous));
    this.state = { items, index, anchor: { x: coords.left, y: coords.top, width: 1, height: coords.bottom - coords.top } };
    this.changed(this.state);
  }
  key = (editor: Editor, event: KeyboardEvent) => {
    if (!this.state || event.isComposing || editor.view.composing) return false;
    if (event.key === "Escape") { this.close(); return true; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const length = this.state.items.length;
      this.state = { ...this.state, index: length ? (this.state.index + (event.key === "ArrowDown" ? 1 : length - 1)) % length : 0 };
      this.changed(this.state); return true;
    }
    if (event.key === "Enter") { if (this.state.items.length) this.choose(editor, this.state.index); return true; }
    return false;
  }
  choose = (editor: Editor, index: number) => {
    const item = this.state?.items[index];
    const start = this.start;
    if (!item || start === undefined) return;
    const end = editor.state.selection.from;
    this.close();
    editor.chain().focus().deleteRange({ from: start, to: end }).run();
    this.execute(item);
  }
  highlight = (index: number) => {
    if (this.state && index !== this.state.index) { this.state = { ...this.state, index }; this.changed(this.state); }
  }
  close = () => { this.start = undefined; if (this.state) { this.state = null; this.changed(null); } }
}
