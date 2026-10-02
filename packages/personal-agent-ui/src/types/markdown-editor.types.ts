export type MarkdownEditorLabels = {
  toolbar: string; placeholder: string; bold: string; italic: string; heading: string; list: string;
  code: string; search: string; undo: string; redo: string; more: string;
  phrases: Record<string, string>;
  rich: {
    toggle: string; toggleContent: string; callout: string; underline: string; highlight: string; currentBlockActions: string;
    paragraph: string; heading: string; quote: string; divider: string; orderedList: string; taskList: string;
    link: string; image: string; table: string; codeBlock: string; math: string; strike: string;
    insert: string; text: string; advanced: string; url: string; confirm: string; upload: string; caption: string;
    language: string; noResults: string; copy: string; preview: string; hide: string; edit: string;
    mathHint: string; mathExample: string; inlineMath: string; blockMath: string;
    loading: string; loadSlow: string; loadError: string; reload: string; error: string; imageError: string; metadata: string;
    addRow: string; addColumn: string; deleteRow: string; deleteColumn: string;
    toggleHeaderRow: string; toggleHeaderColumn: string; alignLeft: string; alignCenter: string; alignRight: string; mergeCells: string; splitCell: string;
    moveRowUp: string; moveRowDown: string; moveColumnLeft: string; moveColumnRight: string;
    uploadingImage: string; uploadContentChanged: string;
    imageAlt: string; imageWidth: string; imageAutoWidth: string; resizeImage: string;
    commands: string; commandHint: string; unlink: string; selectionTools: string; clearFormatting: string;
    appendRow: string; appendColumn: string; rowActions: string; columnActions: string; addRowBefore: string; addColumnBefore: string;
    commandNavigate: string; commandDescriptions: Record<string, string>;
    deleteBlock: string; turnInto: string;
    blockActions: string; searchBlockActions: string; duplicateBlock: string; insertBeforeBlock: string; insertAfterBlock: string; copyCode: string; blockNames: Record<string, string>;
    find: string; replace: string; next: string; previous: string; replaceAll: string; close: string;
  };
};

export type MarkdownEditorProps = {
  /** Embedded editors grow with their content inside the parent page's scroll area. */
  layout?: "document" | "embedded";
  /** Optional host for document tools in the surrounding page header. */
  toolbarContainer?: HTMLElement | null;
  /** Focus the body once when a newly created document mounts. */
  autoFocus?: boolean;
  value: string; onChange: (value: string) => void; source: boolean; label: string;
  labels: MarkdownEditorLabels; active?: boolean; scrollProgress?: number;
  /** Reloads the host after a failed module request; the host owns draft preservation. */
  onLoadRetry?: () => void;
  onScrollProgress?: (progress: number) => void;
  uploadImage?: (file: File) => Promise<string>;
};

export type MarkdownAction = "bold" | "italic" | "strike" | "underline" | "highlight" | "toggle" | "callout" | "code" | "clearFormatting" | "list" | "orderedList" | "taskList" | "quote" | "divider" | "link" | "image" | "table" | "codeBlock" | "math" | "inlineMath" | "undo" | "redo" | "addRow" | "addColumn" | "deleteRow" | "deleteColumn" | "mergeCells" | "splitCell";
export type MarkdownAnchor = { x: number; y: number; width: number; height: number };
export type MarkdownSelection = { bold: boolean; italic: boolean; strike: boolean; underline?: boolean; highlight?: boolean; code: boolean; link: boolean; undo: boolean; redo: boolean; heading: number; table: boolean; mergeCells?: boolean; splitCell?: boolean; uploading?: boolean; uploadError?: string; codeLanguage?: string; anchor?: MarkdownAnchor };
export type MarkdownInspector = { kind: "link" | "image" | "math"; value: string; position?: number; inline?: boolean; anchor?: MarkdownAnchor; replace?: { from: number; to: number }; image?: { alt: string; title: string; width: number | null } };
export type MarkdownSlashItem = { id: "paragraph" | "h1" | "h2" | "h3" | "list" | "orderedList" | "taskList" | "quote" | "toggle" | "callout" | "table" | "codeBlock" | "math" | "inlineMath" | "image" | "link" | "divider"; label: string; keywords: string; group: "text" | "advanced" };
export type MarkdownSlashState = { items: MarkdownSlashItem[]; index: number; anchor: MarkdownAnchor };
