import { Profiler, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatMessageList, type ChatMessageTexts } from "@nextclaw/agent-chat-ui";
import {
  createChatToolCallStressViewModel,
  DEFAULT_CHAT_TOOL_CALL_STRESS_CONFIG,
  type ChatToolCallStressConfig,
} from "@/features/chat/features/message/utils/chat-tool-call-stress-fixture.utils";

type StressMetric = {
  action: string;
  commitMs: number;
  nextFrameMs: number;
};

declare global {
  interface Window {
    __nextclawChatToolStress?: {
      latestMetric: StressMetric | null;
      config: ChatToolCallStressConfig;
    };
  }
}

const STRESS_TEXTS: ChatMessageTexts = {
  copyCodeLabel: "Copy",
  copiedCodeLabel: "Copied",
  copyMessageLabel: "Copy",
  copiedMessageLabel: "Copied",
  typingLabel: "Thinking…",
  toolActivitySegmentTemplates: {
    read: { one: "Read 1 file", other: "Read {count} files" },
    edit: { one: "Edit 1 file", other: "Edit {count} files" },
    directory: { one: "View 1 directory", other: "View {count} directories" },
    search: { one: "Search 1 time", other: "Search {count} times" },
    bash: { one: "Run 1 command", other: "Run {count} commands" },
    web: { one: "Open 1 page", other: "Open {count} pages" },
    agent: { one: "Start 1 subtask", other: "Start {count} subtasks" },
    panel: { one: "Show 1 result", other: "Show {count} results" },
    other: { one: "Use 1 tool", other: "Use {count} tools" },
  },
  toolActivityFailedLabel: "failed",
  toolActivityCancelledLabel: "cancelled",
};

function readBoundedNumber(value: string, fallback: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(1, Math.min(maximum, Math.round(parsed)))
    : fallback;
}

export function ChatToolCallStressHarness() {
  const [config, setConfig] = useState(DEFAULT_CHAT_TOOL_CALL_STRESS_CONFIG);
  const [renderVersion, setRenderVersion] = useState(0);
  const [metric, setMetric] = useState<StressMetric | null>(null);
  const pendingMeasurement = useRef<{ action: string; startedAt: number } | null>(null);
  const viewModel = useMemo(
    () => createChatToolCallStressViewModel(config, `chat-tool-call-stress-message-${renderVersion}`),
    [config, renderVersion],
  );
  const publishMetric = useCallback((nextMetric: StressMetric | null) => {
    setMetric(nextMetric);
    window.__nextclawChatToolStress = { latestMetric: nextMetric, config };
  }, [config]);
  const startMeasurement = useCallback((action: string, update: () => void) => {
    pendingMeasurement.current = { action, startedAt: performance.now() };
    update();
  }, []);

  useEffect(() => {
    window.__nextclawChatToolStress = { latestMetric: metric, config };
  }, [config, metric]);

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <section className="mx-auto max-w-5xl space-y-5">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold">Chat tool-call stress harness</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            One assistant message with dense, nested NCP tool invocations. This data remains in the browser and is never written into a session.
          </p>
        </header>
        <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3">
          {([
            ["toolCallCount", "Tool calls", 1_000],
            ["argumentBytesPerCall", "Argument bytes / call", 65_536],
            ["resultBytesPerCall", "Result bytes / call", 65_536],
          ] as const).map(([key, label, maximum]) => (
            <label key={key} className="grid gap-1 text-sm">
              <span>{label}</span>
              <input
                aria-label={label}
                className="rounded border border-input bg-background px-2 py-1"
                min="1"
                max={maximum}
                type="number"
                value={config[key]}
                onChange={(event) => setConfig((current) => ({
                  ...current,
                  [key]: readBoundedNumber(event.target.value, current[key], maximum),
                }))}
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            onClick={() => startMeasurement("rerender", () => setRenderVersion((value) => value + 1))}
          >
            Re-render message
          </button>
          <button
            type="button"
            className="rounded border border-border px-3 py-1.5 text-sm"
            onClick={() => {
              const summary = Array.from(
                document.querySelectorAll<HTMLButtonElement>("[data-chat-process-meta-row]"),
              ).find((candidate) => candidate.parentElement?.classList.contains("group/tool-activity"));
              if (!summary) return;
              const startedAt = performance.now();
              const observer = new MutationObserver(() => {
                observer.disconnect();
                requestAnimationFrame(() => publishMetric({
                  action: summary.getAttribute("aria-expanded") === "true" ? "expand" : "collapse",
                  commitMs: performance.now() - startedAt,
                  nextFrameMs: performance.now() - startedAt,
                }));
              });
              observer.observe(document.body, { childList: true, subtree: true });
              summary.click();
            }}
          >
            Toggle tool details
          </button>
          <button
            type="button"
            className="rounded border border-border px-3 py-1.5 text-sm"
            onClick={() => startMeasurement("stream-update", () => setConfig((current) => ({
              ...current,
              resultBytesPerCall: Math.min(65_536, current.resultBytesPerCall + 1),
            })))}
          >
            Simulate stream update
          </button>
        </div>
        <output aria-live="polite" data-stress-metric="true" className="block rounded bg-muted px-3 py-2 font-mono text-xs">
          {metric
            ? `${metric.action}: commit ${metric.commitMs.toFixed(1)}ms, next frame ${metric.nextFrameMs.toFixed(1)}ms`
            : "Run an action to record a browser metric."}
        </output>
        <Profiler
          id="chat-tool-call-stress"
          onRender={(_id, _phase, actualDuration) => {
            const pending = pendingMeasurement.current;
            if (!pending) return;
            pendingMeasurement.current = null;
            requestAnimationFrame(() => publishMetric({
              action: pending.action,
              commitMs: actualDuration,
              nextFrameMs: performance.now() - pending.startedAt,
            }));
          }}
        >
          <section data-stress-message="true" className="rounded-lg border border-border p-4">
            <ChatMessageList
              messages={[viewModel]}
              isSending={false}
              hasAssistantDraft={false}
              texts={STRESS_TEXTS}
            />
          </section>
        </Profiler>
      </section>
    </main>
  );
}
