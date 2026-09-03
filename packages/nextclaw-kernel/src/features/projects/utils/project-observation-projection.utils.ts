import type { NcpSessionSummary } from "@nextclaw/ncp";
import type {
  ObservedProjectRun,
  ProjectObservationReference,
} from "@kernel/features/projects/types/project-observation.types.js";

export const projectObservationConfigReference = (
  asOf: string,
): ProjectObservationReference => ({
  kind: "project-config",
  label: "项目配置",
  observedAt: asOf,
  projectRelativePath: ".nextclaw/project.yaml",
});

export const projectObservationFileReference = (
  path: string,
  observedAt: string,
): ProjectObservationReference => ({
  kind: "file-observation",
  label: "文件观测",
  observedAt,
  projectRelativePath: path,
});

const readOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const readProjectRunState = (
  session: NcpSessionSummary,
): ObservedProjectRun["state"] => {
  const state = (
    session.metadata?.last_activity_preview as { state?: unknown } | undefined
  )?.state;
  if (
    state === "running" ||
    state === "completed" ||
    state === "failed" ||
    state === "cancelled" ||
    state === "idle"
  ) {
    return state;
  }
  return session.status === "running" ? "running" : "idle";
};

export function projectObservedRuns(
  sessions: NcpSessionSummary[],
): ObservedProjectRun[] {
  return sessions
    .map((session) => {
      const preview = session.metadata?.last_activity_preview as
        | { timestamp?: unknown; statusText?: unknown }
        | undefined;
      const updatedAt =
        readOptionalString(preview?.timestamp) ??
        session.lastMessageAt ??
        session.updatedAt;
      const model =
        readOptionalString(session.metadata?.preferred_model) ??
        readOptionalString(session.metadata?.preferredModel) ??
        readOptionalString(session.metadata?.model);
      const label = readOptionalString(session.metadata?.label);
      const statusText = readOptionalString(preview?.statusText);
      return {
        sessionId: session.sessionId,
        state: readProjectRunState(session),
        updatedAt,
        ...(session.agentId ? { agentId: session.agentId } : {}),
        ...(model ? { model } : {}),
        ...(label ? { label } : {}),
        ...(statusText ? { statusText } : {}),
        reference: {
          kind: "system-record" as const,
          label: "会话运行",
          observedAt: updatedAt,
          sessionId: session.sessionId,
        },
      };
    })
    .sort((left, right) => {
      const runningOrder =
        Number(right.state === "running") - Number(left.state === "running");
      return runningOrder || right.updatedAt.localeCompare(left.updatedAt);
    });
}
