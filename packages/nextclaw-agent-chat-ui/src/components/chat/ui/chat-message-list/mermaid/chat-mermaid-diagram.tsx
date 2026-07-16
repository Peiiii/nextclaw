import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Mermaid } from "mermaid";
import { ChatCodeBlock } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-code-block";
import type { ChatMessageTexts } from "@agent-chat-ui/components/chat/view-models/chat-ui.types";

type MermaidTheme = "default" | "dark";
const STREAMING_RENDER_INTERVAL_MS = 200;

type MermaidRenderRequest = {
  isFinal: boolean;
  key: string;
  source: string;
  theme: MermaidTheme;
};

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
    | "mermaidLoadingLabel"
    | "mermaidRenderErrorLabel"
  >;
}) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const renderSequence = useRef(0);
  const theme = useMermaidTheme();
  const normalizedSource = source.trim();
  const renderKey = `${theme}:${normalizedSource}`;
  const latestRequest = useRef<MermaidRenderRequest>({
    isFinal: !isStreaming,
    key: renderKey,
    source: normalizedSource,
    theme,
  });
  const renderTimeout = useRef<number | null>(null);
  const renderInProgress = useRef(false);
  const lastRenderStartedAt = useRef(Date.now());
  const mounted = useRef(true);
  const [renderRequest, setRenderRequest] =
    useState<MermaidRenderRequest | null>(null);
  const [state, setState] = useState<MermaidRenderState>(null);
  const diagramLabel = texts.mermaidDiagramLabel ?? "Mermaid diagram";
  const loadingLabel = texts.mermaidLoadingLabel ?? "Rendering diagram…";
  const errorLabel =
    texts.mermaidRenderErrorLabel ?? "Diagram could not be rendered";

  const scheduleLatestRender = useCallback((immediate: boolean) => {
    if (!mounted.current || renderInProgress.current) {
      return;
    }
    if (renderTimeout.current !== null) {
      if (!immediate) {
        return;
      }
      window.clearTimeout(renderTimeout.current);
      renderTimeout.current = null;
    }
    const elapsed = Date.now() - lastRenderStartedAt.current;
    const delay = immediate
      ? 0
      : Math.max(0, STREAMING_RENDER_INTERVAL_MS - elapsed);
    renderTimeout.current = window.setTimeout(() => {
      renderTimeout.current = null;
      setRenderRequest(latestRequest.current);
    }, delay);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (renderTimeout.current !== null) {
        window.clearTimeout(renderTimeout.current);
        renderTimeout.current = null;
      }
    };
  }, []);

  useEffect(() => {
    latestRequest.current = {
      isFinal: !isStreaming,
      key: renderKey,
      source: normalizedSource,
      theme,
    };
    scheduleLatestRender(!isStreaming);
  }, [isStreaming, normalizedSource, renderKey, scheduleLatestRender, theme]);

  useEffect(() => {
    if (!renderRequest) {
      return;
    }
    let active = true;
    const renderDiagram = async () => {
      renderInProgress.current = true;
      lastRenderStartedAt.current = Date.now();
      try {
        const mermaid = await loadMermaid();
        if (!active || !mounted.current) {
          return;
        }
        renderSequence.current += 1;
        const diagramId = `nextclaw-mermaid-${reactId}-${renderSequence.current}`;
        mermaid.initialize({
          securityLevel: "strict",
          startOnLoad: false,
          suppressErrorRendering: true,
          theme: renderRequest.theme,
        });
        const valid = await mermaid.parse(renderRequest.source, {
          suppressErrors: true,
        });
        if (!active || !mounted.current) {
          return;
        }
        if (!valid) {
          throw new Error("Invalid Mermaid diagram");
        }
        const { svg } = await mermaid.render(diagramId, renderRequest.source);
        if (
          active &&
          mounted.current &&
          latestRequest.current.theme === renderRequest.theme
        ) {
          setState({ key: renderRequest.key, status: "rendered", svg });
        }
      } catch {
        if (
          active &&
          mounted.current &&
          renderRequest.isFinal &&
          latestRequest.current.key === renderRequest.key
        ) {
          setState({ key: renderRequest.key, status: "error" });
        }
      } finally {
        renderInProgress.current = false;
        const pendingRequest = latestRequest.current;
        if (
          active &&
          mounted.current &&
          (pendingRequest.key !== renderRequest.key ||
            pendingRequest.isFinal !== renderRequest.isFinal)
        ) {
          scheduleLatestRender(pendingRequest.isFinal);
        }
      }
    };
    void renderDiagram();

    return () => {
      active = false;
    };
  }, [reactId, renderRequest, scheduleLatestRender]);

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

  return (
    <figure
      aria-label={diagramLabel}
      aria-busy={!currentState}
      data-chat-mermaid-diagram="true"
      data-chat-mermaid-pending={!renderedState || undefined}
      data-chat-mermaid-updating={!currentState || undefined}
      className={
        renderedState
          ? "my-3 min-h-24 overflow-auto py-2"
          : "my-3 flex min-h-14 items-center justify-center rounded-xl bg-muted/20 px-3 py-2"
      }
    >
      {renderedState ? (
        <div
          className="min-w-fit [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: renderedState.svg }}
        />
      ) : (
        <div
          role="status"
          className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground/80"
        >
          <Loader2
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
          />
          <span>{loadingLabel}</span>
        </div>
      )}
    </figure>
  );
}
