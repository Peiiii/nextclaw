import { Link } from "react-router-dom";
import type { ObservedRequest } from "@nextclaw/client-sdk";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import { t } from "@/shared/lib/i18n";
import { canReplyToProjectRequest } from "@/features/projects/presenters/project-home.presenter";
import type { ProjectRequestDecision } from "@/features/projects/utils/project-request-response.utils";
import { ProjectSection } from "./project-section";

export function ProjectRequests({
  requests,
  pendingRequestId,
  onReply,
}: {
  requests: ObservedRequest[];
  pendingRequestId: string | null;
  onReply: (request: ObservedRequest, decision: ProjectRequestDecision) => void;
}) {
  if (requests.length === 0) return null;
  return (
    <ProjectSection title={t("projectsRequests")}>
      <div className="space-y-2">
        {requests.map((request) => {
          const { id, prompt, reference: { label, sessionId }, reply } = request;
          const isPending = pendingRequestId === id;
          return (
            <div key={id} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/45 p-3">
              <div className="min-w-48 flex-1">
                <p className="text-sm font-medium">{prompt}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {reply ? t("projectsResponseWaiting") : label}
                </p>
              </div>
              {canReplyToProjectRequest(request) ? (
                <>
                  <Button size="sm" disabled={isPending} onClick={() => onReply(request, "confirmed")}>
                    {t("projectsConfirm")}
                  </Button>
                  <Button size="sm" variant="outline" disabled={isPending} onClick={() => onReply(request, "rejected")}>
                    {t("projectsReject")}
                  </Button>
                </>
              ) : null}
              {sessionId ? (
                <Link
                  className={buttonVariants({ size: "sm", variant: "ghost" })}
                  to={`/chat/${encodeURIComponent(sessionId)}`}
                >
                  {t("projectsOpenSession")}
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </ProjectSection>
  );
}
