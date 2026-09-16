import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useProjects } from "@/shared/hooks/use-projects";
import { useViewportLayout } from "@/app/hooks/use-viewport-layout";
import { t } from "@/shared/lib/i18n";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { ProjectAgreement } from "@/features/projects/components/project-agreement";
import { ProjectArtifacts } from "@/features/projects/components/project-artifacts";
import { ProjectOverview } from "@/features/projects/components/project-overview";
import { ProjectSkills } from "@/features/projects/components/project-skills";
import { ProjectWorkItemDrawer } from "@/features/projects/components/work/project-work-item-drawer";
import { ProjectWorkItems } from "@/features/projects/components/work/project-work-items";
import {
  ChatConversationWorkspaceSection,
  usePresenter,
} from "@/features/chat";
import {
  useProjectAgreement,
  useProjectSkills,
} from "@/features/projects/hooks/use-project-materials";
import {
  isProjectHomeTab,
  type ProjectHomeTab,
} from "@/features/projects/presenters/project-home.presenter";
import { joinProjectPath } from "@/features/projects/utils/project-artifact-view.utils";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { pageResourceFromSystemObject } from "@/features/right-panel-resources";

const PROJECT_TABS: ProjectHomeTab[] = [
  "overview",
  "work",
  "artifacts",
  "skills",
  "agreement",
];

export function ProjectsPage({ resourceId, resourceWorkId }: { resourceId?: string; resourceWorkId?: string } = {}) {
  const app = useAppPresenter();
  const { projectId: routeProjectId, tab: routeTab } = useParams<{
    projectId?: string;
    tab?: string;
  }>();
  const projectId = resourceId ?? routeProjectId;
  const [resourceTab, setResourceTab] = useState<ProjectHomeTab>("overview");
  const tabParam = resourceId ? resourceTab : routeTab;
  const navigate = useNavigate();
  const { state } = useLocation();
  const presenter = usePresenter();
  const { isMobile } = useViewportLayout();
  const projects = useProjects();
  const openWorkItem = (id: string) => app.pageResourceManager.open(pageResourceFromSystemObject("project-work", JSON.stringify([projectId, id]), id), "default", navigate);
  const registered = projects.data?.projects ?? [];
  const selectedProject =
    registered.find((project) => project.id === projectId) ?? null;
  const tab: ProjectHomeTab | null = isProjectHomeTab(tabParam)
    ? tabParam
    : null;
  const agreement = useProjectAgreement(
    tab === "agreement" ? (selectedProject?.id ?? null) : null,
  );
  const skills = useProjectSkills(
    tab === "skills" ? (selectedProject?.id ?? null) : null,
  );
  if (projects.isLoading)
    return (
      <main className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        {t("projectsLoading")}
      </main>
    );
  if (projects.isError)
    return (
      <main className="p-6 text-sm text-destructive">
        {t("projectsLoadFailed")}: {projects.error.message}
      </main>
    );
  if (resourceId && !selectedProject) return <p role="alert" className="p-4">{t("resourceNotFound")}</p>;
  if (!registered.length)
    return (
      <main className="p-6 text-sm text-muted-foreground">
        {t("projectsEmpty")}
      </main>
    );
  if (!selectedProject || !tab)
    return (
      <main className="space-y-3 p-4 text-sm text-muted-foreground sm:p-6">
        <label htmlFor="project-home-selection" className="block font-medium text-foreground">{t("projectsChoose")}</label>
        <select
          id="project-home-selection"
          value=""
          onChange={(event) => navigate(`/projects/${encodeURIComponent(event.target.value)}/overview`, { state })}
          className="min-h-11 w-full rounded-xl border border-border bg-card px-3 text-base text-foreground"
        >
          <option value="" disabled>{t("projectsChoose")}</option>
          {registered.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </main>
    );

  const openProjectFile = (path: string, label: string) =>
    presenter.chatThreadManager.openFilePreview({
      path,
      label,
      viewMode: "preview",
      previewViewer: "rendered",
    });
  if (resourceWorkId) return <ProjectWorkItemDrawer embedded projectId={selectedProject.id} projectRoot={selectedProject.rootPath}
    workItemId={resourceWorkId} onOpenChange={(open) => { if (!open) navigate(`/projects/${encodeURIComponent(selectedProject.id)}/work`); }} onOpenArtifact={openProjectFile} />;
  return (
    <>
      <main className="h-full min-w-0 flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <header className="rounded-2xl border border-border/60 bg-card p-3 sm:p-4">
            <h1 className="text-lg font-semibold">{selectedProject.name}</h1>
            <p className="mt-1 break-all text-xs text-muted-foreground">
              {selectedProject.rootPath}
            </p>
          </header>
          <Tabs
            value={tab}
            onValueChange={(value) =>
              resourceId && isProjectHomeTab(value) ? setResourceTab(value) : navigate(
                `/projects/${encodeURIComponent(selectedProject.id)}/${value}`,
                { state },
              )
            }
          >
            <div className="min-w-0 overflow-x-auto pb-1">
              <TabsList className="w-max">
                {PROJECT_TABS.map((key) => (
                  <TabsTrigger key={key} value={key}>
                    {t(`projects${key[0].toUpperCase()}${key.slice(1)}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <TabsContent value="overview" className="mt-4">
              <ProjectOverview
                projectId={selectedProject.id}
                onOpenArtifact={(path, label) =>
                  openProjectFile(
                    joinProjectPath(selectedProject.rootPath, path),
                    label,
                  )
                }
                onOpenWorkItem={openWorkItem}
              />
            </TabsContent>
            <TabsContent value="work" className="mt-4">
              <ProjectWorkItems
                projectId={selectedProject.id}
                onOpenWorkItem={openWorkItem}
              />
            </TabsContent>
            <TabsContent value="artifacts" className="mt-4">
              <ProjectArtifacts
                projectId={selectedProject.id}
                onOpenFile={(path, label) =>
                  openProjectFile(
                    joinProjectPath(selectedProject.rootPath, path),
                    label,
                  )
                }
              />
            </TabsContent>
            <TabsContent value="skills" className="mt-4">
              <ProjectSkills
                skills={skills.data ?? []}
                isLoading={skills.isLoading}
                isError={skills.isError}
                onOpen={(skill) =>
                  app.pageResourceManager.open(pageResourceFromSystemObject("skill", skill.ref, skill.name), "default", navigate)
                }
              />
            </TabsContent>
            <TabsContent value="agreement" className="mt-4">
              <ProjectAgreement
                agreement={agreement.data}
                isLoading={agreement.isLoading}
                isError={agreement.isError}
                onOpenFile={(path, label) =>
                  openProjectFile(
                    joinProjectPath(selectedProject.rootPath, path),
                    label,
                  )
                }
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      {!resourceId && <ChatConversationWorkspaceSection
        layoutMode={isMobile ? "mobile" : "desktop"}
        sessionKey={null}
        projectRoot={selectedProject.rootPath}
      />}
    </>
  );
}
