import type { ProjectObservationSnapshot } from "@nextclaw/client-sdk";
import { formatNumber, t } from "@/shared/lib/i18n";
import { ProjectEmptyState } from "./project-section";

export function ProjectSkills({
  snapshot,
  onOpen,
}: {
  snapshot: ProjectObservationSnapshot;
  onOpen: (skill: ProjectObservationSnapshot["skills"][number]) => void;
}) {
  return (
    <section className="min-w-0" aria-label={t("projectsSkills")}>
      <p className="mb-3 text-sm text-muted-foreground">
        {formatNumber(snapshot.skills.length)} {t("projectsSkillsCountSuffix")}
      </p>
      {snapshot.skills.length ? (
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
          {snapshot.skills.map((skill) => (
            <button
              type="button"
              key={skill.ref}
              className="min-w-0 rounded-xl border border-border/60 p-3 text-left transition-colors enabled:hover:border-border enabled:hover:bg-muted/30 disabled:cursor-not-allowed"
              disabled={!skill.readable}
              onClick={() => onOpen(skill)}
            >
              <h3 className="text-sm font-medium">{skill.name}</h3>
              <p
                className="mt-1 truncate text-xs text-muted-foreground"
                title={skill.path}
              >
                {skill.path}
              </p>
              <p
                className="mt-2 line-clamp-2 text-xs text-muted-foreground"
                title={skill.description ?? skill.ref}
              >
                {skill.description ?? skill.ref}
              </p>
              {!skill.readable ? (
                <p className="mt-2 text-xs text-destructive">
                  {t("projectsUnavailable")}
                </p>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <ProjectEmptyState>{t("projectsNoSkills")}</ProjectEmptyState>
      )}
    </section>
  );
}
