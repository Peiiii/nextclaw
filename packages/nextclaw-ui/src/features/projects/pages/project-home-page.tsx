import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ObservedRequest,
  ProjectObservationSnapshot,
} from "@nextclaw/client-sdk";
import { toast } from "sonner";
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
import { ProjectRequests } from "@/features/projects/components/project-requests";
import { ProjectSkills } from "@/features/projects/components/project-skills";
import { ProjectWorkItems } from "@/features/projects/components/project-work-items";
import { ChatConversationWorkspaceSection } from "@/features/chat/components/conversation/chat-conversation-workspace-section";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import {
  projectObservationQueryKey,
  useProjectObservation,
} from "@/features/projects/hooks/use-project-observation";
import {
  getOpenProjectRequests,
  isProjectHomeTab,
  type ProjectHomeTab,
} from "@/features/projects/presenters/project-home.presenter";
import {
  sendProjectRequestResponse,
  type ProjectRequestDecision,
} from "@/features/projects/utils/project-request-response.utils";

const PROJECT_TABS: ProjectHomeTab[] = [
  "overview",
  "work",
  "artifacts",
  "skills",
  "agreement",
];

function shouldOfferObservationSetup(
  sources: ProjectObservationSnapshot["sources"],
): boolean {
  const config = sources.find((source) => source.id === "config");
  return !config || config.status !== "available";
}

function hasObservedProjectSessions(
  sources: ProjectObservationSnapshot["sources"],
): boolean {
  return (sources.find((source) => source.id === "sessions")?.itemCount ?? 0) > 0;
}

export function ProjectsPage() {
  const { projectId, tab: tabParam } = useParams<{ projectId?: string; tab?: string }>();
  const navigate = useNavigate();
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const presenter = usePresenter();
  const { isMobile } = useViewportLayout();
  const projects = useProjects();
  const registered = projects.data?.projects ?? [];
  const selectedProject = registered.find((project) => project.id === projectId) ?? null;
  const tab: ProjectHomeTab | null = isProjectHomeTab(tabParam) ? tabParam : null;
  const observation = useProjectObservation(
    selectedProject?.id ?? null,
    selectedProject?.rootPath ?? null,
  );
  const response = useMutation({
    mutationFn: sendProjectRequestResponse,
    onMutate: (input) => setPendingRequestId(input.requestId),
    onSuccess: async () => {
      if (selectedProject) {
        await queryClient.invalidateQueries({
          queryKey: projectObservationQueryKey(selectedProject.id),
        });
      }
      toast.success(t("projectsResponseSent"));
    },
    onError: (error) =>
      toast.error(
        `${t("projectsResponseFailed")}: ${error instanceof Error ? error.message : String(error)}`,
      ),
    onSettled: () => setPendingRequestId(null),
  });

  const reply = (
    request: ObservedRequest,
    decision: ProjectRequestDecision,
  ) => {
    if (!request.reference.sessionId) return;
    response.mutate({
      requestId: request.id,
      sessionId: request.reference.sessionId,
      decision,
      prompt: request.prompt,
    });
  };

  if (projects.isLoading) {
    return (
      <main className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        {t("projectsLoading")}
      </main>
    );
  }
  if (projects.isError) {
    return (
      <main className="p-6 text-sm text-destructive">
        {t("projectsLoadFailed")}: {projects.error.message}
      </main>
    );
  }
  if (registered.length === 0) {
    return (
      <main className="p-6 text-sm text-muted-foreground">
        {t("projectsEmpty")}
      </main>
    );
  }
  if (!selectedProject || !tab) {
    return (
      <main className="p-6 text-sm text-muted-foreground">
        {t("projectsChoose")}
      </main>
    );
  }

  const snapshot = observation.data;
  const startObservationSetup = () =>
    presenter.chatSessionListManager.createSession({
      projectRoot: selectedProject.rootPath,
      prompt: t("projectsObservationSetupPrompt"),
    });
  const startProjectWork = () =>
    presenter.chatSessionListManager.createSession({
      projectRoot: selectedProject.rootPath,
      prompt: t("projectsStartProjectWorkPrompt"),
    });
  const openProjectFile = (path: string, label: string) =>
    presenter.chatThreadManager.openFilePreview({
      path,
      label,
      viewMode: "preview",
      previewViewer: "rendered",
    });
  return (
    <>
    <main className="h-full min-w-0 flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-3 sm:space-y-4">
        <header className="hidden flex-wrap items-center gap-3 md:flex">
          <h1 className="text-xl font-semibold">{t("projectsTitle")}</h1>
        </header>

        {observation.isLoading ? (
          <div className="rounded-xl border border-border/60 p-5 text-sm text-muted-foreground">
            {t("projectsLoading")}
          </div>
        ) : null}
        {observation.isError ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-sm text-destructive">
            {t("projectsLoadFailed")}: {observation.error.message}
          </div>
        ) : null}
        {snapshot ? (
          <>
            <section className="rounded-2xl border border-border/60 bg-card p-3 sm:p-4">
              <h2 className="text-lg font-semibold">{snapshot.project.name}</h2>
              {snapshot.project.summary ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {snapshot.project.summary}
                </p>
              ) : null}
              <p className="mt-2 break-all text-xs text-muted-foreground">
                {snapshot.project.rootPath}
              </p>
            </section>
            <ProjectRequests
              requests={getOpenProjectRequests(snapshot)}
              pendingRequestId={pendingRequestId}
              onReply={reply}
            />
            <Tabs
              value={tab}
              onValueChange={(value) =>
                navigate(`/projects/${encodeURIComponent(selectedProject.id)}/${value}`)
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
                  hasProjectSessions={hasObservedProjectSessions(snapshot.sources)}
                  snapshot={snapshot}
                  shouldOfferObservationSetup={shouldOfferObservationSetup(snapshot.sources)}
                  onOpenFile={openProjectFile}
                  onStartObservationSetup={startObservationSetup}
                  onStartProjectWork={startProjectWork}
                />
              </TabsContent>
              <TabsContent value="work" className="mt-4">
                <ProjectWorkItems
                  hasProjectSessions={hasObservedProjectSessions(snapshot.sources)}
                  snapshot={snapshot}
                  shouldOfferObservationSetup={shouldOfferObservationSetup(snapshot.sources)}
                  onStartObservationSetup={startObservationSetup}
                  onStartProjectWork={startProjectWork}
                />
              </TabsContent>
              <TabsContent value="artifacts" className="mt-4">
                <ProjectArtifacts snapshot={snapshot} onOpenFile={openProjectFile} />
              </TabsContent>
              <TabsContent value="skills" className="mt-4">
                <ProjectSkills
                  snapshot={snapshot}
                  onOpen={(skill) =>
                    presenter.chatThreadManager.openFilePreview({
                      path: skill.path,
                      label: skill.name,
                      viewMode: "preview",
                      previewViewer: "rendered",
                    })
                  }
                />
              </TabsContent>
              <TabsContent value="agreement" className="mt-4">
                <ProjectAgreement snapshot={snapshot} onOpenFile={openProjectFile} />
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>
    </main>
    <ChatConversationWorkspaceSection
      layoutMode={isMobile ? "mobile" : "desktop"}
      sessionKey={null}
      projectRoot={selectedProject.rootPath}
    />
    </>
  );
}
