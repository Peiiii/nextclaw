export type MarkdownEditorLabels = {
  toolbar: string; placeholder: string; bold: string; italic: string; heading: string; list: string;
  code: string; search: string; undo: string; redo: string; more: string;
  phrases: Record<string, string>;
  rich: {
    paragraph: string; heading: string; quote: string; divider: string; orderedList: string; taskList: string;
    link: string; image: string; table: string; codeBlock: string; math: string; strike: string;
    insert: string; text: string; advanced: string; url: string; confirm: string; upload: string; caption: string;
    language: string; noResults: string; copy: string; preview: string; hide: string; edit: string;
    mathHint: string; mathExample: string; inlineMath: string; blockMath: string;
    loading: string; error: string; imageError: string; metadata: string;
    addRow: string; addColumn: string; deleteRow: string; deleteColumn: string;
    commands: string; commandHint: string; unlink: string;
    appendRow: string; appendColumn: string; rowActions: string; columnActions: string; addRowBefore: string; addColumnBefore: string;
    commandNavigate: string; commandDescriptions: Record<string, string>;
    deleteBlock: string; turnInto: string;
    blockActions: string; searchBlockActions: string; duplicateBlock: string; insertBeforeBlock: string; insertAfterBlock: string; copyCode: string; blockNames: Record<string, string>;
    find: string; replace: string; next: string; previous: string; replaceAll: string; close: string;
  };
};

export type MarkdownEditorProps = {
  value: string; onChange: (value: string) => void; source: boolean; label: string;
  labels: MarkdownEditorLabels; active?: boolean; scrollProgress?: number;
  onScrollProgress?: (progress: number) => void;
};

export type MarkdownAction = "bold" | "italic" | "strike" | "code" | "list" | "orderedList" | "taskList" | "quote" | "divider" | "link" | "image" | "table" | "codeBlock" | "math" | "inlineMath" | "undo" | "redo" | "addRow" | "addColumn" | "deleteRow" | "deleteColumn";
export type MarkdownAnchor = { x: number; y: number; width: number; height: number };
export type MarkdownSelection = { bold: boolean; italic: boolean; undo: boolean; redo: boolean; heading: number; table: boolean; codeLanguage?: string };
export type MarkdownInspector = { kind: "link" | "image" | "math"; value: string; position?: number; inline?: boolean; anchor?: MarkdownAnchor; replace?: { from: number; to: number } };
export type MarkdownSlashItem = { id: "paragraph" | "h1" | "h2" | "h3" | "list" | "orderedList" | "taskList" | "quote" | "table" | "codeBlock" | "math" | "inlineMath" | "image" | "link" | "divider"; label: string; keywords: string };
export type MarkdownSlashState = { items: MarkdownSlashItem[]; index: number; anchor: MarkdownAnchor };
