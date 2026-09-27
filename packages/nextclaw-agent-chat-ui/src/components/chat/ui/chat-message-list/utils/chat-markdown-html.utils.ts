import { defaultSchema } from "rehype-sanitize";

type MarkdownIdNode = {
  type: string;
  children?: MarkdownIdNode[];
  properties?: Record<string, unknown>;
};
function decodeFragment(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

/** Keep sanitized IDs and their references within one message, including footnotes. */
export function createRehypeChatMarkdownIds(prefix: string) {
  return () => (tree: MarkdownIdNode) => {
    const elements: MarkdownIdNode[] = [];
    const ids = new Map<string, string>();
    const visit = (node: MarkdownIdNode) => {
      if (node.properties) elements.push(node);
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
    for (const node of elements) {
      const id = node.properties?.id;
      if (typeof id !== "string") continue;
      const scopedId = `${prefix}${decodeFragment(id)}`;
      ids.set(id, scopedId);
      // rehype-sanitize prefixes IDs for DOM clobbering protection, but not hrefs.
      if (id.startsWith("user-content-")) ids.set(id.slice("user-content-".length), scopedId);
      node.properties!.id = scopedId;
    }
    for (const node of elements) {
      const props = node.properties!;
      if (typeof props.href === "string" && props.href.startsWith("#")) {
        const fragment = props.href.slice(1);
        const target = ids.get(fragment) ?? ids.get(decodeFragment(fragment));
        if (target) props.href = `#${target}`;
      }
      if (Array.isArray(props.ariaDescribedBy)) {
        props.ariaDescribedBy = props.ariaDescribedBy.map((id) => typeof id === "string" ? ids.get(id) ?? id : id);
      }
    }
  };
}

/** Sanitize before KaTeX; retain only the data consumed by our Markdown components. */
export const chatMarkdownHtmlSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    div: [...(defaultSchema.attributes?.div ?? []), "dataFrontmatter", "dataChatMathPending", "ariaBusy"],
    span: [...(defaultSchema.attributes?.span ?? []),
      ...["Kind", "Key", "Ref", "Name", "Source", "Path", "Label", "RawText", "Excerpt", "MessageId", "Role", "StartLine", "EndLine"]
        .map(suffix => `dataChatInlineToken${suffix}`),
    ],
    code: [["className", /^language-./, "math-inline", "math-display"]],
    details: ["open"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), "nextclaw", "file"],
  },
};
