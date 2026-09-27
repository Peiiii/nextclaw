import { useEffect, useId, useRef, useState } from "react";
import type { MarkdownLabels } from "./markdown";

type DiagramState = { source: string; status: "ready"; svg: string } | { source: string; status: "error" };

export function MarkdownMermaidDiagram({ source, labels }: { source: string; labels: MarkdownLabels }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const sequence = useRef(0);
  const [state, setState] = useState<DiagramState | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      if (!source.trim() || source.length > 50_000) {
        setState({ source, status: "error" });
        return;
      }
      try {
        const mermaid = (await import("mermaid")).default;
        if (!active) return;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", suppressErrorRendering: true, theme: "neutral" });
        const valid = await mermaid.parse(source, { suppressErrors: true });
        if (!valid) throw new Error("Invalid diagram");
        const { svg } = await mermaid.render(`ui-mermaid-${id}-${++sequence.current}`, source);
        if (active) setState({ source, status: "ready", svg });
      } catch {
        if (active) setState({ source, status: "error" });
      }
    }, 400);
    return () => { active = false; window.clearTimeout(timer); };
  }, [id, source]);

  if (!state || state.source !== source) return <div className="ui-mermaid" role="status" aria-busy="true">{labels.diagramLoading}</div>;
  if (state.status === "error") return <div className="ui-mermaid ui-mermaid--error" role="status">
    <p>{labels.diagramError}</p>
    <pre><code>{source}</code></pre>
  </div>;
  return <div className="ui-mermaid" role="img" aria-label={labels.diagramAlt} dangerouslySetInnerHTML={{ __html: state.svg }} />;
}
