import { parseDocument, stringify } from "yaml";

type FrontmatterNode = {
  type: string;
  value?: string;
  children?: FrontmatterNode[];
  data?: Record<string, unknown>;
};

/** Keep front matter in the Markdown AST, outside body headings and math. */
export function remarkFrontmatterDisplay() {
  return (tree: FrontmatterNode) => {
    for (const node of tree.children ?? []) {
      if (node.type !== "yaml") continue;
      // The default YAML-to-HAST handler discards metadata nodes.
      node.type = "frontmatter";
      node.data = {
        ...node.data,
        hName: "div",
        hProperties: { "data-frontmatter": node.value ?? "" },
        hChildren: [],
      };
    }
  };
}

export function readFrontmatterFields(source: string): [string, string][] | null {
  try {
    const document = parseDocument(source, { uniqueKeys: true });
    if (document.errors.length || document.warnings.length) return null;
    const value: unknown = document.toJS({ maxAliasCount: 50 });
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    // Reject cycles before formatting nested YAML values.
    JSON.stringify(value);
    return Object.entries(value).map(([key, field]) => [
      key,
      field === null ? "null" : typeof field === "object"
        ? stringify(field).trimEnd()
        : String(field),
    ]);
  } catch {
    return null;
  }
}
