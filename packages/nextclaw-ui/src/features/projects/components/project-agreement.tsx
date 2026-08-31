import type { ProjectObservationSnapshot } from "@nextclaw/client-sdk";
import { t } from "@/shared/lib/i18n";
import {
  ProjectEmptyState,
  ProjectFilePreviewButton,
  ProjectSection,
} from "./project-section";

export function ProjectAgreement({
  snapshot,
  onOpenFile,
}: {
  snapshot: ProjectObservationSnapshot;
  onOpenFile: (path: string, label: string) => void;
}) {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <ProjectSection title={t("projectsVisionAndContext")}>
        {snapshot.project.summary ? (
          <p className="mb-4 text-sm">{snapshot.project.summary}</p>
        ) : null}
        {snapshot.project.context.length ? (
          <div className="divide-y divide-border/60">
            {snapshot.project.context.map((context) => (
              <ProjectContextReference
                key={context.id}
                context={context}
                onOpenFile={onOpenFile}
              />
            ))}
          </div>
        ) : (
          <ProjectEmptyState>{t("projectsNoContext")}</ProjectEmptyState>
        )}
      </ProjectSection>
      <ProjectSection title={t("projectsSourceHealth")}>
        <div className="space-y-2">
          {snapshot.sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-muted/45 p-3 text-sm"
            >
              <span>{source.label}</span>
              <span className="text-muted-foreground">
                {t(`projectsSource_${source.status}`)} · {source.itemCount}
              </span>
            </div>
          ))}
        </div>
        {snapshot.diagnostics.length ? (
          <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
            {snapshot.diagnostics.map((diagnostic) => (
              <div
                key={diagnostic.id}
                className="rounded-xl bg-muted/35 p-3 text-sm"
              >
                <p className="font-medium">{diagnostic.code}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {diagnostic.message}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </ProjectSection>
    </div>
  );
}

function ProjectContextReference({
  context,
  onOpenFile,
}: {
  context: ProjectObservationSnapshot["project"]["context"][number];
  onOpenFile: (path: string, label: string) => void;
}) {
  const { accessible, role, source } = context;
  return (
    <ProjectFilePreviewButton
      available={accessible}
      path={source}
      label={role}
      onOpen={onOpenFile}
      className="block w-full py-3 text-left first:pt-0 enabled:hover:text-foreground enabled:focus-visible:outline-none enabled:focus-visible:ring-1 enabled:focus-visible:ring-border"
    >
      <span className="block text-sm font-medium">{role}</span>
      <span className="mt-1 block truncate text-xs text-muted-foreground">
        {source}{!accessible ? ` · ${t("projectsUnavailable")}` : ""}
      </span>
    </ProjectFilePreviewButton>
  );
}
