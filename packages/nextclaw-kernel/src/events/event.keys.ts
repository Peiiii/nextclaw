import type { NcpSessionSummary } from "@nextclaw/ncp";
import type { UpdateSnapshot } from "../types/update.types.js";
import type { AppEventKey } from "./event-bus.types.js";

export function createAppEventKey<T>(id: string): AppEventKey<T> {
  return { id };
}

export const eventKeys = {
  configUpdated: createAppEventKey<{ path: string }>("config.updated"),
  channelConfigApplyStatus: createAppEventKey<{
    channel: string;
    status: "started" | "succeeded" | "failed";
    message?: string;
  }>("channel.config.apply-status"),
  sessionUpdated: createAppEventKey<{ sessionKey: string }>("session.updated"),
  sessionRunStatus: createAppEventKey<{
    sessionKey: string;
    status: "running" | "idle";
  }>("session.run-status"),
  sessionSummaryUpsert: createAppEventKey<{ summary: NcpSessionSummary }>(
    "session.summary.upsert",
  ),
  sessionSummaryDelete: createAppEventKey<{ sessionKey: string }>(
    "session.summary.delete",
  ),
  configReloadStarted: createAppEventKey<Record<string, unknown> | undefined>(
    "config.reload.started",
  ),
  configReloadFinished: createAppEventKey<Record<string, unknown> | undefined>(
    "config.reload.finished",
  ),
  error: createAppEventKey<{ message: string; code?: string }>("error"),
  connectionOpen: createAppEventKey<Record<string, never> | undefined>(
    "connection.open",
  ),
  connectionClose: createAppEventKey<Record<string, never> | undefined>(
    "connection.close",
  ),
  connectionError: createAppEventKey<{ message?: string } | undefined>(
    "connection.error",
  ),
  runtimeUpdateSnapshot: createAppEventKey<UpdateSnapshot>(
    "runtime.update.snapshot",
  ),
} as const;
