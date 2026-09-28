export type FileDocumentView = { wide: boolean; small: boolean; headings: { title: string; level: number }[]; characters: number };
const preferenceKey = "bibo.document.appearance";

/** Read-only navigation and local presentation; drafts remain owned by the space store. */
export class FileDocumentManager {
  private root?: HTMLElement;
  private observer?: MutationObserver;
  private timer?: ReturnType<typeof setTimeout>;
  private headings: HTMLElement[] = [];
  readonly initial: FileDocumentView;
  private state: FileDocumentView;
  constructor(private readonly changed: (value: FileDocumentView) => void) {
    let preference: Partial<FileDocumentView> = {};
    try { preference = JSON.parse(localStorage.getItem(preferenceKey) ?? "{}"); } catch { /* Browser storage can be unavailable. */ }
    this.initial = this.state = { wide: preference?.wide === true, small: preference?.small === true, headings: [], characters: 0 };
  }
  bind = (root: HTMLElement) => { this.root = root; this.applyAppearance(); };
  appearance = (key: "wide" | "small", value: boolean) => {
    this.state = { ...this.state, [key]: value }; this.applyAppearance(); this.changed(this.state);
    try { localStorage.setItem(preferenceKey, JSON.stringify({ wide: this.state.wide, small: this.state.small })); } catch { /* The active view still works without persistence. */ }
  };
  private applyAppearance = () => {
    this.root?.style.setProperty("--document-max-width", this.state.wide ? "none" : "820px");
    this.root?.style.setProperty("--document-font-size", this.state.small ? "13px" : "15px");
  };
  open = (open: boolean) => {
    this.observer?.disconnect(); clearTimeout(this.timer);
    if (!open || !this.root) return;
    this.read();
    this.observer = new MutationObserver(() => { clearTimeout(this.timer); this.timer = setTimeout(this.read, 200); });
    this.observer.observe(this.root, { childList: true, subtree: true, characterData: true });
  };
  private surface = () => this.root?.querySelector<HTMLElement>(".bibo-file-preview-markdown .chat-markdown, .bibo-file-editor-surface:not([hidden]) .tiptap");
  private read = () => {
    const surface = this.surface();
    this.headings = Array.from(surface?.querySelectorAll<HTMLElement>(":scope > h1,:scope > h2,:scope > h3,:scope > h4,:scope > h5,:scope > h6") ?? []);
    this.state = { ...this.state, headings: this.headings.map(element => ({ title: element.textContent ?? "", level: Number(element.tagName.slice(1)) })),
      characters: Array.from((surface?.textContent ?? "").replace(/\s/g, "")).length };
    this.changed(this.state);
  };
  navigate = (index: number) => { this.headings[index]?.scrollIntoView({ block: "start", behavior: "instant" }); };
  destroy = () => { this.observer?.disconnect(); clearTimeout(this.timer); this.root = undefined; };
}
