import { Editor, type JSONContent } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { NodeSelection, TextSelection, type Command, type SelectionBookmark } from "@tiptap/pm/state";
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
  private dismissedSelection = "";
  private readonly uploads = new Map<symbol, SelectionBookmark>();
  private uploadError = "";
  clearUploadError = () => { this.uploadError = ""; this.notify(); };
  private contentRevision = 0;
  private readonly slash: MarkdownSlashManager;
  readonly blocks: MarkdownBlockManager;

  constructor(props: MarkdownEditorProps, private readonly changed: (state: MarkdownSelection) => void,
    private readonly openSearch: () => void, private readonly inspect: (value: MarkdownInspector) => void,
    slashChanged: (state: MarkdownSlashState | null) => void, blockChanged: (state: MarkdownBlockState | null) => void,
    private readonly mounted: (error?: string) => void) {
    this.props = props;
    this.projected = props.value;
    this.blocks = new MarkdownBlockManager(blockChanged, this.openInspector);
    this.slash = new MarkdownSlashManager(props.labels, slashChanged, item => this.insertCommand(item.id));
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
          if (this.blocks.key(event)) return true;
          if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.isComposing && this.openMathShortcut()) { event.preventDefault(); return true; }
          if (event.key === "F10" && event.shiftKey) { event.preventDefault(); this.blocks.openAtSelection(); return true; }
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") { event.preventDefault(); this.openSearch(); return true; }
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); this.run("link"); return true; }
          return false;
        },
        handleTextInput: (_view, from, _to, text) => text === " " && this.openMathShortcut() || (this.editor ? this.slash.input(this.editor, from, text) : false),
        handlePaste: (_view, event) => this.uploadFiles(Array.from(event.clipboardData?.files ?? [])),
        handleDrop: (view, event, _slice, moved) => {
          if (moved || !this.props.uploadImage || !event.dataTransfer?.files.length) return false;
          const position = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (position) view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(position.pos))));
          return this.uploadFiles(Array.from(event.dataTransfer.files));
        },
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
      onTransaction: ({ transaction }) => { this.uploads.forEach((bookmark, id) => this.uploads.set(id, bookmark.map(transaction.mapping))); this.notify(); this.blocks.update(transaction); if (this.editor) this.slash.update(this.editor, transaction); },
      onFocus: () => this.notify(),
      onBlur: () => { this.flush(); this.slash.close(); this.notify(); },
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
    const attrs = value.kind === "image" && value.position !== undefined ? editor.state.doc.nodeAt(value.position)?.attrs : undefined;
    this.inspect({ ...value, ...(value.kind === "image" ? { image: { alt: String(attrs?.alt ?? ""), title: String(attrs?.title ?? ""), width: attrs?.width ? Number(attrs.width) : null } } : {}), anchor: { x: coords.left, y: coords.top, width: 1, height: coords.bottom - coords.top } });
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
  insertCommand = (id: MarkdownSlashState["items"][number]["id"]) => {
    if (id === "paragraph") this.heading(0);
    else if (id === "h1" || id === "h2" || id === "h3") this.heading(Number(id.slice(1)));
    else this.run(id);
  };
  private uploadFiles = (files: File[]) => {
    if (!this.props.uploadImage || !files.length) return false;
    void this.uploadImage(files);
    return true;
  };
  uploadImage = async (input: File | File[], image?: MarkdownInspector["image"]) => {
    const editor = this.editor, upload = this.props.uploadImage;
    if (!editor || !upload) return;
    const id = Symbol("image-upload");
    const revision = this.contentRevision;
    this.uploads.set(id, editor.state.selection.getBookmark()); this.uploadError = ""; this.notify();
    try {
      const files = Array.isArray(input) ? input : [input];
      const sources = await Promise.all(files.map(upload));
      const bookmark = this.uploads.get(id);
      if (editor.isDestroyed || !bookmark) return;
      if (revision !== this.contentRevision || this.props.active === false && this.props.value !== this.projected) throw new Error(this.props.labels.rich.uploadContentChanged);
      const selection = bookmark.resolve(editor.state.doc);
      const images = sources.map((src, index) => editor.schema.nodes.image.create({ src, ...image, alt: image?.alt || files[index].name.replace(/\.[^.]+$/, "") }));
      const transaction = closeHistory(editor.state.tr);
      if (selection.$from.parent.type.contentMatch.matchType(editor.schema.nodes.image)) transaction.replaceWith(selection.from, selection.to, images);
      else transaction.insert(selection instanceof NodeSelection || !selection.$from.depth ? selection.to : selection.$from.after(), editor.schema.nodes.paragraph.create(null, images));
      editor.view.dispatch(transaction); editor.view.dispatch(closeHistory(editor.state.tr)); this.flush();
    } catch (error) { this.uploadError = error instanceof Error ? error.message : this.props.labels.rich.error; }
    finally { this.uploads.delete(id); if (!editor.isDestroyed) this.notify(); }
  };
  insertBlock = async (fromHandle = false) => {
    const editor = this.editor;
    if (!editor) return;
    if (!fromHandle) this.blocks.targetSelection();
    if (fromHandle || editor.state.selection.$from.parent.type.name !== "paragraph" || editor.state.selection.$from.parent.content.size || !editor.state.selection.empty) await this.blocks.perform("after");
    this.slash.open(editor);
  };
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
    if (!doc.eq(editor.state.doc)) {
      this.contentRevision++;
      editor.view.dispatch(editor.state.tr.replaceWith(0, editor.state.doc.content.size, doc.content).setMeta("preventUpdate", true).setMeta("addToHistory", false));
    }
  }

  private notify = () => {
    const editor = this.editor;
    if (!editor) return;
    if (editor.state.selection.empty) this.dismissedSelection = "";
    const value: MarkdownSelection = {
      bold: editor.isActive("bold"), italic: editor.isActive("italic"), strike: editor.isActive("strike"), code: editor.isActive("code"), link: editor.isActive("link"),
      underline: editor.isActive("underline"), highlight: editor.isActive("highlight"),
      undo: editor.can().undo(), redo: editor.can().redo(),
      heading: editor.isActive("heading") ? Number(editor.getAttributes("heading").level) : 0,
      table: editor.isActive("table"), codeLanguage: editor.isActive("codeBlock") ? String(editor.getAttributes("codeBlock").language ?? "plaintext") : undefined,
      anchor: this.selectionAnchor(),
      mergeCells: editor.isActive("table") && editor.can().mergeCells(), splitCell: editor.isActive("table") && editor.can().splitCell(),
      uploading: this.uploads.size > 0, uploadError: this.uploadError,
    };
    const identity = JSON.stringify(value);
    if (identity !== this.previousSelection) { this.previousSelection = identity; this.changed(value); }
  }

  private selectionAnchor = () => {
    const editor = this.editor;
    if (!editor || this.props.active === false || !editor.isFocused || editor.view.composing || editor.isActive("codeBlock")) return;
    const selection = editor.state.selection;
    if (!(selection instanceof TextSelection) || selection.empty || this.dismissedSelection === `${selection.from}:${selection.to}`) return;
    const first = editor.view.coordsAtPos(selection.from), last = editor.view.coordsAtPos(selection.to);
    const viewport = editor.view.dom.closest(".ui-rich-markdown-scroll")?.getBoundingClientRect();
    if (!viewport || first.top < viewport.top || first.top > viewport.bottom) return;
    return { x: Math.min(first.left, last.left), y: first.top, width: Math.max(1, Math.abs(last.left - first.left)), height: first.bottom - first.top };
  };
  dismissSelectionTools = () => {
    const selection = this.editor?.state.selection;
    this.dismissedSelection = selection ? `${selection.from}:${selection.to}` : "";
    this.notify();
  };

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
      bold: () => chain.toggleBold(), italic: () => chain.toggleItalic(), code: () => chain.toggleCode(), clearFormatting: () => chain.unsetAllMarks(),
      underline: () => chain.toggleUnderline(), highlight: () => chain.toggleHighlight(),
      toggle: () => editor.isActive("details") ? chain.unsetDetails() : chain.setDetails().updateAttributes("details", { open: true }),
      callout: () => chain.setBlockquote().updateAttributes("blockquote", { callout: "note" }),
      strike: () => chain.toggleStrike(), list: () => chain.toggleBulletList(), orderedList: () => chain.toggleOrderedList(),
      taskList: () => chain.toggleTaskList(), quote: () => chain.toggleBlockquote(), divider: () => chain.setHorizontalRule(),
      table: () => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }), codeBlock: () => chain.toggleCodeBlock(),
      undo: () => chain.undo(), redo: () => chain.redo(), addRow: () => chain.addRowAfter(), addColumn: () => chain.addColumnAfter(),
      deleteRow: () => chain.deleteRow(), deleteColumn: () => chain.deleteColumn(),
      mergeCells: () => chain.mergeCells(), splitCell: () => chain.splitCell(),
    };
    actions[action]().run();
  }

  applyInspector = (inspector: MarkdownInspector, value: string, image?: MarkdownInspector["image"]) => {
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
      editor.view.dispatch(editor.state.tr.setNodeMarkup(inspector.position, undefined, { ...editor.state.doc.nodeAt(inspector.position)?.attrs, ...(inspector.kind === "image" ? { ...image, height: null } : {}), [inspector.kind === "math" ? "latex" : "src"]: value }));
    } else if (inspector.kind === "image") chain.setImage({ src: value, alt: image?.alt, title: image?.title, width: image?.width ?? undefined }).run();
    else if (inspector.inline) chain.insertInlineMath({ latex: value }).run();
    else chain.insertBlockMath({ latex: value }).run();
    this.flush();
    editor.view.dispatch(closeHistory(editor.state.tr));
  }

  search = (query: string, replacement: string) => { const view = this.editor?.view; if (view) view.dispatch(setSearchState(view.state.tr, new SearchQuery({ search: query, replace: replacement, literal: true }))); }
  searchAction = (action: "next" | "previous" | "replace" | "all") => { this.command(({ next: findNext, previous: findPrev, replace: replaceNext, all: replaceAll })[action]); }
  focus = () => { this.editor?.view.focus(); }
  destroy = () => {
    this.uploads.clear();
    this.flush();
    window.removeEventListener("pagehide", this.flush);
    window.removeEventListener("beforeunload", this.flush);
    document.removeEventListener("pointerdown", this.flush, true);
    document.removeEventListener("keydown", this.flushOnSave, true);
    this.blocks.destroy();
    this.editor?.destroy();
  }
}
