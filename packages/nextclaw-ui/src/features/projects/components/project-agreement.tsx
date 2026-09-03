import type { ProjectAgreementMaterial } from "@nextclaw/client-sdk";
import { t } from "@/shared/lib/i18n";
import {
  ProjectEmptyState,
  ProjectFilePreviewButton,
  ProjectSection,
} from "./project-section";

export function ProjectAgreement({
  agreement,
  isLoading,
  isError,
  onOpenFile,
}: {
  agreement?: ProjectAgreementMaterial;
  isLoading: boolean;
  isError: boolean;
  onOpenFile: (path: string, label: string) => void;
}) {
  return (
    <ProjectSection title={t("projectsAgreementFile")}>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("projectsAgreementDescription")}
      </p>
      {isLoading ? (
        <p className="py-5 text-sm text-muted-foreground">
          {t("projectsLoading")}
        </p>
      ) : isError ? (
        <p className="py-5 text-sm text-destructive">
          {t("projectsLoadFailed")}
        </p>
      ) : agreement?.available ? (
        <ProjectFilePreviewButton
          available
          path={agreement.path}
          label={agreement.path}
          onOpen={onOpenFile}
          className="block w-full rounded-xl bg-muted/45 p-3 text-left transition-colors enabled:hover:bg-[var(--interaction-hover)] enabled:focus-visible:outline-none enabled:focus-visible:ring-1 enabled:focus-visible:ring-border"
        >
          <span className="block text-sm font-medium">{agreement.path}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {t("projectsAgreementOpen")}
          </span>
        </ProjectFilePreviewButton>
      ) : (
        <ProjectEmptyState>{t("projectsNoAgreement")}</ProjectEmptyState>
      )}
    </ProjectSection>
  );
}
