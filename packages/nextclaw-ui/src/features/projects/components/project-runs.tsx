import { Link } from "react-router-dom";
import type { ProjectObservationSnapshot } from "@nextclaw/client-sdk";
import { formatDateTime, t } from "@/shared/lib/i18n";
import { formatProjectRelativeTime } from "@/features/projects/utils/project-artifact-view.utils";

export function ProjectRuns({
  limit,
  snapshot,
}: {
  limit?: number;
  snapshot: ProjectObservationSnapshot;
}) {
  const availableRuns = snapshot.runs ?? [];
  const runs = limit === undefined ? availableRuns : availableRuns.slice(0, limit);
  if (!runs.length) return null;

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const workItem = run.workItemId
          ? snapshot.workItems.find((item) => item.id === run.workItemId)
          : undefined;
        const workflow = workItem?.workflowId
          ? snapshot.workflows.find((item) => item.id === workItem.workflowId)
          : undefined;
        const stage = workItem?.stageId
          ? workflow?.stages.find((item) => item.id === workItem.stageId)
          : undefined;
        const identity = [run.agentId, run.model].filter(Boolean).join(" · ");
        return (
          <Link
            key={run.sessionId}
            className="block rounded-xl bg-muted/45 p-3 text-sm transition-colors hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
            to={`/chat/${encodeURIComponent(run.sessionId)}`}
          >
            <span className="flex min-w-0 items-center justify-between gap-3">
              <span className="truncate font-medium">
                {run.label ?? workItem?.name ?? t("projectsAiRun")}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t(`projectsRunState_${run.state}`)}
              </span>
            </span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">
              {workItem
                ? `${workItem.name}${stage ? ` · ${stage.label}` : ""}`
                : t("projectsRunUnreported")}
            </span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">
              {identity ? `${identity} · ` : ""}
              <time dateTime={run.updatedAt} title={formatDateTime(run.updatedAt)}>
                {formatProjectRelativeTime(run.updatedAt)}
              </time>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
