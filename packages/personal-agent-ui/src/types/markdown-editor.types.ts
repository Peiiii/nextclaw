export type MarkdownEditorLabels = {
  toolbar: string; placeholder: string; bold: string; italic: string; heading: string; list: string;
  code: string; search: string; undo: string; redo: string; more: string;
  phrases: Record<string, string>;
  rich: {
    paragraph: string; heading: string; quote: string; divider: string; orderedList: string; taskList: string;
    link: string; image: string; table: string; codeBlock: string; math: string; strike: string;
    insert: string; text: string; advanced: string; url: string; confirm: string; upload: string; caption: string;
    language: string; noResults: string; copy: string; preview: string; hide: string; edit: string;
    loading: string; error: string; imageError: string; metadata: string;
    addRow: string; addColumn: string; deleteRow: string; deleteColumn: string;
    find: string; replace: string; next: string; previous: string; replaceAll: string; close: string;
  };
};

export type MarkdownEditorProps = {
  value: string; onChange: (value: string) => void; source: boolean; label: string;
  labels: MarkdownEditorLabels; active?: boolean; scrollProgress?: number;
  onScrollProgress?: (progress: number) => void;
};

export type MarkdownAction = "bold" | "italic" | "strike" | "code" | "list" | "orderedList" | "taskList" | "quote" | "divider" | "link" | "image" | "table" | "codeBlock" | "math" | "undo" | "redo" | "addRow" | "addColumn" | "deleteRow" | "deleteColumn";
export type MarkdownSelection = { bold: boolean; italic: boolean; undo: boolean; redo: boolean; heading: number; table: boolean; codeLanguage?: string };
export type MarkdownInspector = { kind: "link" | "image" | "math"; value: string; position?: number; inline?: boolean };
