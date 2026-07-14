import { useEffect, useId, useRef, useState } from "react";
import type { Mermaid } from "mermaid";
import { ChatCodeBlock } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-code-block";
import type { ChatMessageTexts } from "@agent-chat-ui/components/chat/view-models/chat-ui.types";

type MermaidTheme = "default" | "dark";
const STREAMING_RENDER_DELAY_MS = 300;

type MermaidRenderState =
  | { key: string; status: "rendered"; svg: string }
  | { key: string; status: "error" }
  | null;

let mermaidModulePromise: Promise<Mermaid> | null = null;

function loadMermaid(): Promise<Mermaid> {
  mermaidModulePromise ??= import("mermaid").then((module) => module.default);
  return mermaidModulePromise;
}

function readMermaidTheme(): MermaidTheme {
  if (typeof document === "undefined") {
    return "default";
  }
  const root = document.documentElement;
  return root.getAttribute("data-theme-appearance") === "dark" ||
    root.classList.contains("dark")
    ? "dark"
    : "default";
}

function useMermaidTheme(): MermaidTheme {
  const [theme, setTheme] = useState<MermaidTheme>(readMermaidTheme);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setTheme(readMermaidTheme()));
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-theme-appearance"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

export function ChatMermaidDiagram({
  isStreaming,
  source,
  texts,
}: {
  isStreaming: boolean;
  source: string;
  texts: Pick<
    ChatMessageTexts,
    | "copyCodeLabel"
    | "copiedCodeLabel"
    | "mermaidDiagramLabel"
    | "mermaidRenderErrorLabel"
  >;
}) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const renderSequence = useRef(0);
  const theme = useMermaidTheme();
  const normalizedSource = source.trim();
  const renderKey = `${theme}:${normalizedSource}`;
  const [state, setState] = useState<MermaidRenderState>(null);
  const diagramLabel = texts.mermaidDiagramLabel ?? "Mermaid diagram";
  const errorLabel =
    texts.mermaidRenderErrorLabel ?? "Diagram could not be rendered";

  useEffect(() => {
    let active = true;
    const renderDiagram = async () => {
      try {
        const mermaid = await loadMermaid();
        if (!active) {
          return;
        }
        renderSequence.current += 1;
        const diagramId = `nextclaw-mermaid-${reactId}-${renderSequence.current}`;
        mermaid.initialize({
          securityLevel: "strict",
          startOnLoad: false,
          suppressErrorRendering: true,
          theme,
        });
        const valid = await mermaid.parse(normalizedSource, {
          suppressErrors: true,
        });
        if (!active) {
          return;
        }
        if (!valid) {
          throw new Error("Invalid Mermaid diagram");
        }
        const { svg } = await mermaid.render(diagramId, normalizedSource);
        if (active) {
          setState({ key: renderKey, status: "rendered", svg });
        }
      } catch {
        if (active && !isStreaming) {
          setState({ key: renderKey, status: "error" });
        }
      }
    };
    const timeout = window.setTimeout(
      () => void renderDiagram(),
      isStreaming ? STREAMING_RENDER_DELAY_MS : 0,
    );

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [isStreaming, normalizedSource, reactId, renderKey, theme]);

  const currentState = state?.key === renderKey ? state : null;
  if (currentState?.status === "error") {
    return (
      <div
        data-chat-mermaid-error="true"
        className="my-3 overflow-hidden rounded-xl border border-border bg-muted/25"
      >
        <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
          {errorLabel}
        </div>
        <ChatCodeBlock className="language-mermaid" texts={texts}>
          {normalizedSource}
        </ChatCodeBlock>
      </div>
    );
  }

  const renderedState = state?.status === "rendered" ? state : null;
  if (!renderedState) {
    return (
      <ChatCodeBlock className="language-mermaid" texts={texts}>
        {normalizedSource}
      </ChatCodeBlock>
    );
  }

  return (
    <figure
      aria-label={diagramLabel}
      aria-busy={!currentState}
      data-chat-mermaid-diagram="true"
      data-chat-mermaid-updating={!currentState || undefined}
      className="my-3 min-h-24 overflow-auto rounded-xl border border-border bg-muted/20 p-3"
    >
      <div
        className="min-w-fit [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: renderedState.svg }}
      />
    </figure>
  );
}
