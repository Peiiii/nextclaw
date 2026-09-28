type CalloutNode = { type: string; value?: string; children?: CalloutNode[]; data?: { hProperties?: Record<string, unknown> } };

/** GitHub-style alerts keep their portable source while sharing normal quote rendering. */
export function remarkChatCallout() {
  return (tree: CalloutNode) => {
    const visit = (node: CalloutNode) => {
      const first = node.children?.[0]?.children?.[0];
      const marker = node.type === "blockquote" && first?.type === "text" && /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\n|$)/.exec(first.value ?? "");
      if (marker) {
        first!.value = first!.value!.slice(marker[0].length);
        node.data = { ...node.data, hProperties: { ...node.data?.hProperties, "data-callout": marker[1].toLowerCase() } };
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
