type MathNode = {
  type: string;
  lang?: string | null;
  data?: unknown;
  tagName?: string;
  position?: { start: { offset?: number }; end: { offset?: number } };
  properties?: { className?: string[]; [key: string]: unknown };
  children?: MathNode[];
};

function pendingMath(block: boolean) {
  return {
    type: "element",
    tagName: block ? "div" : "span",
    properties: {
      "data-chat-math-pending": "true",
      "aria-busy": "true",
      style: block
        ? "min-height:3em;display:flex;align-items:center;justify-content:center;opacity:0.6"
        : "opacity:0.6",
    },
    children: [{ type: "text", value: "…" }],
  };
}

function hasClosingFence(node: MathNode, source: string): boolean {
  const raw = source.slice(node.position?.start.offset, node.position?.end.offset);
  const lines = raw.split(/\r\n|\r|\n/);
  const opening = lines[0]?.match(/^(\${2,}|`{3,}|~{3,})/)?.[1];
  if (!opening || lines.length < 2) return false;
  const closing = lines.at(-1)?.replace(/^\s*(?:>\s*)*/, "").trim() ?? "";
  return closing.length >= opening.length && [...closing].every((character) => character === opening[0]);
}

/** Hold unfinished fences before KaTeX sees transient, invalid LaTeX. */
export function createRemarkStreamingMathPlugin(source: string) {
  return () => function transform(node: MathNode): MathNode {
    const isMathFence = node.type === "math" || (node.type === "code" && node.lang === "math");
    if (isMathFence && !hasClosingFence(node, source)) {
      const pending = pendingMath(true);
      return {
        ...node,
        data: {
          hName: pending.tagName,
          hProperties: pending.properties,
          hChildren: pending.children,
        },
      };
    }
    if (node.children) node.children = node.children.map(transform);
    return node;
  };
}

/** A parser error during generation is pending content, not a final error. */
export function rehypeStreamingMath() {
  return function transform(node: MathNode): MathNode {
    if (node.properties?.className?.includes("katex-error")) {
      return pendingMath(false);
    }
    if (node.children) node.children = node.children.map(transform);
    return node;
  };
}
