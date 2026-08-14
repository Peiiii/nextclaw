import { useEffect, useState } from "react";
import type { ChatToolPartViewModel } from "@agent-chat-ui/components/chat/view-models/chat-ui.types";

type ToolExecutionTiming = NonNullable<ChatToolPartViewModel["execution"]>;

function readTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function readStandardDuration(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

export function readCompletedToolDurationMs(
  execution: ToolExecutionTiming | undefined,
): number | null {
  const duration = readStandardDuration(execution?.durationMs);
  if (duration != null) return duration;
  const startedAt = readTimestamp(execution?.startedAt);
  const endedAt = readTimestamp(execution?.endedAt);
  return startedAt != null && endedAt != null && endedAt >= startedAt
    ? endedAt - startedAt
    : null;
}

function formatClockDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

export function formatRunningToolDuration(durationMs: number): string | null {
  if (!Number.isFinite(durationMs) || durationMs < 0) return null;
  return formatClockDuration(durationMs);
}

export function formatCompletedToolDuration(durationMs: number): string | null {
  if (!Number.isFinite(durationMs) || durationMs < 0) return null;
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  if (durationMs < 60_000) {
    const seconds = Number((durationMs / 1000).toFixed(2));
    return `${seconds}s`;
  }
  return formatClockDuration(durationMs);
}

function readMonotonicNow(): number {
  return globalThis.performance?.now() ?? Date.now();
}

type RunningAnchor = {
  key: string;
  baselineMs: number;
  monotonicStartedAt: number;
};

function readAnchorElapsed(anchor: RunningAnchor): number {
  return Math.max(
    0,
    anchor.baselineMs + readMonotonicNow() - anchor.monotonicStartedAt,
  );
}

function useRunningToolDuration(
  execution: ToolExecutionTiming | undefined,
  running: boolean,
): number | null {
  const startedAt = readTimestamp(execution?.startedAt);
  const hasTerminalAnchor =
    readStandardDuration(execution?.durationMs) != null ||
    execution?.endedAt != null;
  const active = running && startedAt != null && !hasTerminalAnchor;
  const [tick, setTick] = useState<{ key: string; elapsedMs: number } | null>(
    null,
  );

  useEffect(() => {
    if (!active || startedAt == null || !execution?.startedAt) {
      setTick(null);
      return;
    }
    const anchor: RunningAnchor = {
      key: execution.startedAt,
      baselineMs: Math.max(0, Date.now() - startedAt),
      monotonicStartedAt: readMonotonicNow(),
    };
    setTick({ key: anchor.key, elapsedMs: readAnchorElapsed(anchor) });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const schedule = (): void => {
      if (document.visibilityState === "hidden") return;
      const elapsedMs = readAnchorElapsed(anchor);
      const delayMs = Math.max(50, 1000 - (elapsedMs % 1000));
      timeoutId = setTimeout(() => {
        setTick({ key: anchor.key, elapsedMs: readAnchorElapsed(anchor) });
        schedule();
      }, delayMs);
    };
    const handleVisibilityChange = (): void => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = undefined;
      if (document.visibilityState === "hidden") return;
      setTick({ key: anchor.key, elapsedMs: readAnchorElapsed(anchor) });
      schedule();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    schedule();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [active, execution?.startedAt, startedAt]);

  if (!active || !execution?.startedAt) return null;
  return tick?.key === execution.startedAt ? tick.elapsedMs : null;
}

export function ToolExecutionDuration({
  execution,
  statusTone,
}: {
  execution?: ToolExecutionTiming;
  statusTone: ChatToolPartViewModel["statusTone"];
}) {
  const completedDurationMs = readCompletedToolDurationMs(execution);
  const runningDurationMs = useRunningToolDuration(
    execution,
    statusTone === "running" && completedDurationMs == null,
  );
  const label =
    completedDurationMs != null
      ? formatCompletedToolDuration(completedDurationMs)
      : runningDurationMs != null
        ? formatRunningToolDuration(runningDurationMs)
        : null;
  if (!label) return null;
  return (
    <span className="inline-flex shrink-0 tabular-nums text-muted-foreground/75">
      {label}
    </span>
  );
}
