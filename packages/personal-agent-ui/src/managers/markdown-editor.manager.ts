import { Editor, type JSONContent } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import type { Command } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";
import { SearchQuery, setSearchState, findNext, findPrev, replaceNext, replaceAll } from "prosemirror-search";
import { markdownEditorExtensions } from "../configs/markdown-editor.config";
import { MarkdownSlashManager } from "./markdown-slash.manager";
import { MarkdownBlockManager, type MarkdownBlockState } from "./markdown-block.manager";
import type { MarkdownAction, MarkdownEditorProps, MarkdownSelection, MarkdownInspector, MarkdownSlashState } from "../types/markdown-editor.types";

export class MarkdownEditorManager {
  private editor?: Editor;
  private projected: string;
  private baseline?: { text: string; doc: Node };
  private props: MarkdownEditorProps;
  private pending?: ReturnType<typeof setTimeout>;
  private dirty = false;
  private previousSelection = "";
  private readonly slash: MarkdownSlashManager;
  readonly blocks: MarkdownBlockManager;

  constructor(props: MarkdownEditorProps, private readonly changed: (state: MarkdownSelection) => void,
    private readonly openSearch: () => void, private readonly inspect: (value: MarkdownInspector) => void,
    slashChanged: (state: MarkdownSlashState | null) => void, blockChanged: (state: MarkdownBlockState | null) => void,
    private readonly mounted: (error?: string) => void) {
    this.props = props;
    this.projected = props.value;
    this.blocks = new MarkdownBlockManager(blockChanged, this.openInspector);
    this.slash = new MarkdownSlashManager(props.labels, slashChanged, item => {
      if (item.id === "paragraph") this.heading(0);
      else if (/^h[123]$/.test(item.id)) this.heading(Number(item.id.slice(1)));
      else this.run(item.id as MarkdownAction);
    });
  }

  mount = (root: HTMLElement) => {
    try { this.mountEditor(root); this.mounted(); }
    catch (cause) { this.mounted(cause instanceof Error ? cause.message : String(cause)); }
  };
  private mountEditor = (root: HTMLElement) => {
    this.editor = new Editor({
      element: root, extensions: markdownEditorExtensions(this.props.labels, this.openInspector),
      content: this.props.value, contentType: "markdown",
      editorProps: {
        attributes: { role: "textbox", "aria-label": this.props.label, "aria-multiline": "true", spellcheck: "true", "data-placeholder": this.props.labels.rich.commandHint },
        handleKeyDown: (_view, event) => {
          if (this.editor && this.slash.key(this.editor, event)) return true;
          if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.isComposing && this.openMathShortcut()) { event.preventDefault(); return true; }
          if (event.key === "F10" && event.shiftKey) { event.preventDefault(); this.blocks.openAtSelection(); return true; }
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") { event.preventDefault(); this.openSearch(); return true; }
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); this.run("link"); return true; }
          return false;
        },
        handleTextInput: (_view, from, _to, text) => text === " " && this.openMathShortcut() || (this.editor ? this.slash.input(this.editor, from, text) : false),
        handleDOMEvents: { pointerdown: (_view, event) => { this.blocks.reveal(event); return false; }, click: (view, event) => {
          const link = (event.target as Element).closest("a");
          if (link) {
            event.preventDefault();
            const from = view.posAtDOM(link, 0);
            this.editor?.commands.setTextSelection({ from, to: from + (link.textContent?.length ?? 0) });
            this.openInspector({ kind: "link", value: link.getAttribute("href") ?? "" }); return true;
          }
          return false;
        } },
      },
      onUpdate: () => { this.dirty = true; clearTimeout(this.pending); this.pending = setTimeout(() => this.flush(), 250); },
      onTransaction: ({ transaction }) => { this.notify(); this.blocks.update(transaction); if (this.editor) this.slash.update(this.editor, transaction); },
      onBlur: () => { this.flush(); this.slash.close(); },
    });
    this.blocks.bind(this.editor);
    this.baseline = { text: this.projected, doc: this.editor.state.doc };
    this.notify();
    window.addEventListener("pagehide", this.flush);
    window.addEventListener("beforeunload", this.flush);
    // Flush before host buttons, links and keyboard navigation consume the draft.
    document.addEventListener("pointerdown", this.flush, true);
    document.addEventListener("keydown", this.flushOnSave, true);
  }

  private openInspector = (value: MarkdownInspector) => {
    const editor = this.editor;
    if (!editor) return;
    const coords = editor.view.coordsAtPos(value.position ?? editor.state.selection.from);
    this.inspect({ ...value, anchor: { x: coords.left, y: coords.top, width: 1, height: coords.bottom - coords.top } });
  };
  private openMathShortcut = () => {
    const editor = this.editor;
    if (!editor || editor.view.composing || !editor.state.selection.empty) return false;
    const cursor = editor.state.selection.$from;
    if (cursor.parent.type.name !== "paragraph" || cursor.parent.textContent !== "$$" || cursor.parentOffset !== 2) return false;
    this.openInspector({ kind: "math", value: "", inline: false, replace: { from: cursor.before(), to: cursor.after() } });
    return true;
  };
  chooseSlash = (index: number) => { if (this.editor) this.slash.choose(this.editor, index); }
  highlightSlash = (index: number) => { this.slash.highlight(index); }
  closeSlash = () => { this.slash.close(); }
  refreshContext = () => { this.notify(); this.blocks.refresh(); if (this.editor) this.slash.update(this.editor, this.editor.state.tr); }

  private flushOnSave = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s" && this.editor?.view.dom.contains(event.target as globalThis.Node)) this.flush();
  };

  flush = () => {
    clearTimeout(this.pending);
    this.pending = undefined;
    const editor = this.editor;
    if (!editor || editor.isDestroyed || !this.dirty) return;
    const text = this.baseline?.doc.eq(editor.state.doc) ? this.baseline.text : editor.getMarkdown();
    this.dirty = false;
    if (text !== this.projected) { this.projected = text; this.props.onChange(text); }
  };

  update = (props: MarkdownEditorProps) => {
    if (props.labels !== this.props.labels) this.slash.updateLabels(props.labels);
    this.props = props;
    const editor = this.editor;
    if (!editor || !props.active || props.value === this.projected) return;
    clearTimeout(this.pending);
    this.dirty = false;
    const json = editor.markdown!.parse(props.value) as JSONContent;
    const doc = editor.schema.nodeFromJSON(json);
    this.projected = props.value;
    this.baseline = { text: props.value, doc };
    if (!doc.eq(editor.state.doc)) editor.view.dispatch(editor.state.tr.replaceWith(0, editor.state.doc.content.size, doc.content).setMeta("preventUpdate", true).setMeta("addToHistory", false));
  }

  private notify = () => {
    const editor = this.editor;
    if (!editor) return;
    const value: MarkdownSelection = {
      bold: editor.isActive("bold"), italic: editor.isActive("italic"),
      undo: editor.can().undo(), redo: editor.can().redo(),
      heading: editor.isActive("heading") ? Number(editor.getAttributes("heading").level) : 0,
      table: editor.isActive("table"), codeLanguage: editor.isActive("codeBlock") ? String(editor.getAttributes("codeBlock").language ?? "plaintext") : undefined,
    };
    const identity = JSON.stringify(value);
    if (identity !== this.previousSelection) { this.previousSelection = identity; this.changed(value); }
  }

  private command = (command: Command) => { const view = this.editor?.view; if (view) command(view.state, view.dispatch, view); }
  heading = (level: number) => { const chain = this.editor?.chain().focus(); if (level) chain?.setHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run(); else chain?.setParagraph().run(); }

  run = (action: MarkdownAction) => {
    const editor = this.editor;
    if (!editor) return;
    if (action === "link" || action === "image" || action === "math" || action === "inlineMath") {
      this.openInspector({ kind: action === "inlineMath" ? "math" : action, inline: action === "inlineMath", value: action === "link" ? String(editor.getAttributes("link").href ?? "") : "" });
      return;
    }
    const chain = editor.chain().focus();
    const actions = {
      bold: () => chain.toggleBold(), italic: () => chain.toggleItalic(), code: () => chain.toggleCode(),
      strike: () => chain.toggleStrike(), list: () => chain.toggleBulletList(), orderedList: () => chain.toggleOrderedList(),
      taskList: () => chain.toggleTaskList(), quote: () => chain.toggleBlockquote(), divider: () => chain.setHorizontalRule(),
      table: () => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }), codeBlock: () => chain.toggleCodeBlock(),
      undo: () => chain.undo(), redo: () => chain.redo(), addRow: () => chain.addRowAfter(), addColumn: () => chain.addColumnAfter(),
      deleteRow: () => chain.deleteRow(), deleteColumn: () => chain.deleteColumn(),
    };
    actions[action]().run();
  }

  applyInspector = (inspector: MarkdownInspector, value: string) => {
    const editor = this.editor;
    if (!editor) return;
    editor.view.dispatch(closeHistory(editor.state.tr));
    const chain = editor.chain().focus();
    if (inspector.kind === "link") {
      if (!value) chain.extendMarkRange("link").unsetLink().run();
      else if (editor.state.selection.empty && !editor.isActive("link")) chain.insertContent({ type: "text", text: value, marks: [{ type: "link", attrs: { href: value } }] }).run();
      else chain.extendMarkRange("link").setLink({ href: value }).run();
    } else if (inspector.replace) {
      const current = editor.state.doc.nodeAt(inspector.replace.from);
      if (current?.type.name !== "paragraph" || current.textContent !== "$$") return;
      chain.insertContentAt(inspector.replace, { type: "blockMath", attrs: { latex: value } }).run();
    } else if (inspector.position !== undefined) {
      editor.view.dispatch(editor.state.tr.setNodeMarkup(inspector.position, undefined, { ...editor.state.doc.nodeAt(inspector.position)?.attrs, [inspector.kind === "math" ? "latex" : "src"]: value }));
    } else if (inspector.kind === "image") chain.setImage({ src: value, alt: this.props.labels.rich.image }).run();
    else if (inspector.inline) chain.insertInlineMath({ latex: value }).run();
    else chain.insertBlockMath({ latex: value }).run();
    this.flush();
    editor.view.dispatch(closeHistory(editor.state.tr));
  }

  search = (query: string, replacement: string) => { const view = this.editor?.view; if (view) view.dispatch(setSearchState(view.state.tr, new SearchQuery({ search: query, replace: replacement, literal: true }))); }
  searchAction = (action: "next" | "previous" | "replace" | "all") => { this.command(({ next: findNext, previous: findPrev, replace: replaceNext, all: replaceAll })[action]); }
  focus = () => { this.editor?.view.focus(); }
  destroy = () => {
    this.flush();
    window.removeEventListener("pagehide", this.flush);
    window.removeEventListener("beforeunload", this.flush);
    document.removeEventListener("pointerdown", this.flush, true);
    document.removeEventListener("keydown", this.flushOnSave, true);
    this.blocks.destroy();
    this.editor?.destroy();
  }
}
