import type { ProjectSkillMaterial } from "@nextclaw/client-sdk";
import { formatNumber, t } from "@/shared/lib/i18n";
import { ProjectEmptyState } from "./project-section";

export function ProjectSkills({
  skills,
  isLoading,
  isError,
  onOpen,
}: {
  skills: ProjectSkillMaterial[];
  isLoading: boolean;
  isError: boolean;
  onOpen: (skill: ProjectSkillMaterial) => void;
}) {
  if (isLoading) {
    return (
      <p className="py-5 text-sm text-muted-foreground">
        {t("projectsLoading")}
      </p>
    );
  }
  if (isError) {
    return (
      <p className="py-5 text-sm text-destructive">{t("projectsLoadFailed")}</p>
    );
  }
  return (
    <section className="min-w-0" aria-label={t("projectsSkills")}>
      <p className="mb-3 text-sm text-muted-foreground">
        {formatNumber(skills.length)} {t("projectsSkillsCountSuffix")}
      </p>
      {skills.length ? (
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
          {skills.map((skill) => (
            <button
              type="button"
              key={skill.ref}
              className="min-w-0 rounded-xl border border-border/60 p-3 text-left transition-colors hover:border-border hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
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
            </button>
          ))}
        </div>
      ) : (
        <ProjectEmptyState>{t("projectsNoSkills")}</ProjectEmptyState>
      )}
    </section>
  );
}
