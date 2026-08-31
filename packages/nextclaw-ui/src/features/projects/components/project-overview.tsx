import { Link } from "react-router-dom";
import type { ProjectObservationSnapshot } from "@nextclaw/client-sdk";
import { Button } from "@/shared/components/ui/button";
import { formatDateTime, t } from "@/shared/lib/i18n";
import {
  ProjectEmptyState,
  ProjectFilePreviewButton,
  ProjectSection,
} from "./project-section";
import {
  DEFAULT_PROJECT_ARTIFACT_SORT,
  formatProjectRelativeTime,
  sortProjectArtifacts,
} from "../utils/project-artifact-view.utils";
import { ProjectRuns } from "./project-runs";

export function ProjectOverview({
  hasProjectSessions,
  snapshot,
  onStartObservationSetup,
  onStartProjectWork,
  onOpenFile,
  shouldOfferObservationSetup,
}: {
  hasProjectSessions: boolean;
  snapshot: ProjectObservationSnapshot;
  onStartObservationSetup: () => void;
  onStartProjectWork: () => void;
  onOpenFile: (path: string, label: string) => void;
  shouldOfferObservationSetup: boolean;
}) {
  const openSignals = snapshot.signals.filter((signal) => signal.status === "open");
  const recentArtifacts = sortProjectArtifacts(snapshot.artifacts, DEFAULT_PROJECT_ARTIFACT_SORT).slice(0, 5);
  const recentActivity = [...snapshot.activity]
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, 6);
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      {shouldOfferObservationSetup ? (
        <ProjectSection title={t("projectsObservationSetupTitle")} className="lg:col-span-2">
          <p className="text-sm text-muted-foreground">
            {t("projectsObservationSetupDescription")}
          </p>
          <button
            type="button"
            className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            onClick={onStartObservationSetup}
          >
            {t("projectsObservationSetupAction")}
          </button>
        </ProjectSection>
      ) : null}
      {(snapshot.runs?.length ?? 0) > 0 ? (
        <ProjectSection title={t("projectsAiActivity")} className="lg:col-span-2">
          <ProjectRuns limit={5} snapshot={snapshot} />
        </ProjectSection>
      ) : null}
      <ProjectSection title={t("projectsAttention")}>
        {openSignals.length ? (
          <div className="space-y-2">
            {openSignals.map((signal) => (
              <div key={signal.id} className="rounded-xl bg-muted/45 p-3 text-sm">
                <p className="font-medium">{signal.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{signal.reference.label} · {signal.level}</p>
              </div>
            ))}
          </div>
        ) : <ProjectEmptyState>{t("projectsNoAttention")}</ProjectEmptyState>}
      </ProjectSection>
      <ProjectSection title={t("projectsWork")}>
        {snapshot.workItems.length ? (
          <div className="space-y-2">
            {snapshot.workItems.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-xl bg-muted/45 p-3 text-sm">
                <p className="font-medium">{item.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.reference.label} · {t(`projectsStatus_${item.status}`)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <>
            <ProjectEmptyState>
              {t(
                shouldOfferObservationSetup
                  ? "projectsWorkNeedsSetup"
                  : hasProjectSessions
                    ? "projectsWorkNoReports"
                    : "projectsWorkNoSessions",
              )}
            </ProjectEmptyState>
            {!shouldOfferObservationSetup ? (
              <Button size="sm" variant="outline" onClick={onStartProjectWork}>
                {t("projectsStartProjectWork")}
              </Button>
            ) : null}
          </>
        )}
      </ProjectSection>
      <ProjectSection title={t("projectsArtifacts")}>
        {recentArtifacts.length ? (
          <div className="space-y-2">
            {recentArtifacts.map((artifact) => (
              <ProjectFilePreviewButton
                key={artifact.id}
                available={artifact.exists}
                path={artifact.path}
                label={artifact.path}
                onOpen={onOpenFile}
                className="block w-full rounded-xl bg-muted/45 p-3 text-left text-sm transition-colors enabled:hover:bg-[var(--interaction-hover)] enabled:focus-visible:outline-none enabled:focus-visible:ring-1 enabled:focus-visible:ring-border"
              >
                <span className="block truncate font-medium">{artifact.path}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {artifact.categoryLabel}
                  {artifact.fileUpdatedAt ? (
                    <time dateTime={artifact.fileUpdatedAt} title={formatDateTime(artifact.fileUpdatedAt)}>
                      {` · ${formatProjectRelativeTime(artifact.fileUpdatedAt)}`}
                    </time>
                  ) : null}
                  {!artifact.exists ? ` · ${t("projectsUnavailable")}` : ""}
                </span>
              </ProjectFilePreviewButton>
            ))}
          </div>
        ) : <ProjectEmptyState>{t("projectsNoArtifacts")}</ProjectEmptyState>}
      </ProjectSection>
      <ProjectSection title={t("projectsActivity")}>
        {recentActivity.length ? (
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="text-sm">
                <p>{activity.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activity.reference.sessionId ? (
                    <Link className="underline underline-offset-2" to={`/chat/${encodeURIComponent(activity.reference.sessionId)}`}>
                      {activity.reference.label}
                    </Link>
                  ) : activity.reference.label} · <time dateTime={activity.at} title={formatDateTime(activity.at)}>
                    {formatProjectRelativeTime(activity.at)}
                  </time>
                </p>
              </div>
            ))}
          </div>
        ) : <ProjectEmptyState>{t("projectsNoActivity")}</ProjectEmptyState>}
      </ProjectSection>
    </div>
  );
}
