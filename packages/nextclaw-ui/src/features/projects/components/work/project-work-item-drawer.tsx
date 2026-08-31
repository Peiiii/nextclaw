import { useState } from "react";
import type {
  ProjectWorkActivity,
  ProjectWorkItemDetail,
  ProjectWorkState,
} from "@nextclaw/client-sdk";
import { ExternalLink, Link2, Trash2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/overlays/sheet";
import { Textarea } from "@/shared/components/ui/textarea";
import { t } from "@/shared/lib/i18n";
import {
  useProjectWork,
  useProjectWorkActions,
  useProjectWorkActivity,
  useProjectWorkItem,
} from "@/features/projects/hooks/use-project-work";

export function ProjectWorkItemDrawer({
  onOpenArtifact,
  onOpenChange,
  projectId,
  projectRoot,
  workItemId,
}: {
  onOpenArtifact: (path: string, label: string) => void;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectRoot: string;
  workItemId: string | null;
}) {
  const item = useProjectWorkItem(projectId, workItemId);
  const activity = useProjectWorkActivity(projectId, workItemId);
  const work = useProjectWork(projectId, true);
  return (
    <Sheet open={Boolean(workItemId)} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={t("projectsCloseDetails")}
        className="flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-[680px]"
      >
        {item.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">
            {t("projectsLoading")}
          </div>
        ) : null}
        {item.isError ? (
          <div className="p-6 text-sm text-destructive">
            {t("projectsWorkItemLoadFailed")}
          </div>
        ) : null}
        {item.data ? (
          <ProjectWorkItemEditor
            key={`${item.data.id}:${item.data.version}`}
            item={item.data}
            states={work.data?.states ?? []}
            activities={activity.data?.activities ?? []}
            onOpenArtifact={(path, label) =>
              onOpenArtifact(joinProjectPath(projectRoot, path), label)
            }
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ProjectWorkItemEditor({
  activities,
  item,
  onClose,
  onOpenArtifact,
  states,
}: {
  activities: ProjectWorkActivity[];
  item: ProjectWorkItemDetail;
  onClose: () => void;
  onOpenArtifact: (path: string, label: string) => void;
  states: ProjectWorkState[];
}) {
  const actions = useProjectWorkActions(item.projectId);
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [stateId, setStateId] = useState(item.stateId);
  const [attention, setAttention] = useState(item.attention);
  const [artifactPath, setArtifactPath] = useState("");
  const [artifactLabel, setArtifactLabel] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const runAction = async (
    action: () => Promise<unknown>,
    onSuccess?: () => void,
  ) => {
    try {
      await action();
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("projectsWorkActionFailed"),
      );
    }
  };
  const save = async () => {
    try {
      await actions.updateItem.mutateAsync({
        workItemId: item.id,
        patch: {
          title,
          description,
          stateId,
          attention,
          expectedVersion: item.version,
        },
      });
      toast.success(t("projectsWorkItemSaved"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("projectsWorkItemSaveFailed"),
      );
    }
  };
  const linkArtifact = async () => {
    if (!artifactPath.trim()) return;
    try {
      await actions.linkArtifact.mutateAsync({
        workItemId: item.id,
        path: artifactPath.trim(),
        ...(artifactLabel.trim() ? { label: artifactLabel.trim() } : {}),
      });
      setArtifactPath("");
      setArtifactLabel("");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("projectsWorkArtifactLinkFailed"),
      );
    }
  };
  return (
    <>
      <SheetHeader className="shrink-0 border-b border-border/60 px-5 pb-5 pt-6 pr-14 sm:px-7 sm:pt-7">
        <SheetTitle>{t("projectsWorkDetails")}</SheetTitle>
        <SheetDescription>
          {item.id} · {t("projectsWorkVersion")} {item.version}
        </SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-7">
        <section className="space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">
            {t("projectsWorkTitle")}
          </label>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <label className="block text-xs font-medium text-muted-foreground">
            {t("projectsWorkDescription")}
          </label>
          <Textarea
            className="min-h-28"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("projectsStatus")}
              </label>
              <Select value={stateId} onValueChange={setStateId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {states.map((state) => (
                    <SelectItem key={state.id} value={state.id}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("projectsWorkAttention")}
              </label>
              <Select
                value={attention}
                onValueChange={(value) =>
                  setAttention(value as typeof attention)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t("projectsWorkAttention_none")}
                  </SelectItem>
                  <SelectItem value="blocked">
                    {t("projectsWorkAttention_blocked")}
                  </SelectItem>
                  <SelectItem value="awaiting-user">
                    {t("projectsWorkAttention_awaiting-user")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>
        <section>
          <h3 className="mb-3 text-sm font-semibold">
            {t("projectsWorkArtifacts")}
          </h3>
          <div className="space-y-2">
            {item.artifacts.map((artifact) => (
              <div
                key={artifact.id}
                className="flex items-center gap-2 rounded-xl border border-border/60 p-2"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-lg px-2 py-1 text-left hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                  onClick={() =>
                    onOpenArtifact(
                      artifact.path,
                      artifact.label ?? artifact.path,
                    )
                  }
                >
                  <span className="flex items-center gap-2 truncate text-sm font-medium">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    {artifact.label ?? artifact.path}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {artifact.path}
                  </span>
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t("projectsWorkUnlinkArtifact")}
                  onClick={() =>
                    void runAction(() =>
                      actions.unlinkArtifact.mutateAsync({
                        workItemId: item.id,
                        artifactLinkId: artifact.id,
                      }),
                    )
                  }
                >
                  <Unlink className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {!item.artifacts.length ? (
              <p className="text-sm text-muted-foreground">
                {t("projectsWorkNoArtifacts")}
              </p>
            ) : null}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
            <Input
              value={artifactPath}
              onChange={(event) => setArtifactPath(event.target.value)}
              placeholder={t("projectsWorkArtifactPath")}
            />
            <Input
              value={artifactLabel}
              onChange={(event) => setArtifactLabel(event.target.value)}
              placeholder={t("projectsWorkArtifactLabel")}
            />
            <Button
              variant="outline"
              onClick={() => void linkArtifact()}
              disabled={!artifactPath.trim() || actions.linkArtifact.isPending}
            >
              <Link2 className="mr-2 h-4 w-4" />
              {t("projectsWorkLinkArtifact")}
            </Button>
          </div>
        </section>
        <section>
          <h3 className="mb-3 text-sm font-semibold">
            {t("projectsActivity")}
          </h3>
          <ol className="space-y-2">
            {activities.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl bg-muted/35 px-3 py-2 text-sm"
              >
                <span className="font-medium">
                  {t(`projectsWorkActivity_${entry.type}`)}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {entry.actor.kind} ·{" "}
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <SheetFooter className="shrink-0 border-t border-border/60 bg-background px-5 py-4 sm:px-7">
        {item.deletedAt ? (
          <Button
            variant="outline"
            onClick={() =>
              void runAction(() => actions.restoreItem.mutateAsync(item.id))
            }
          >
            {t("projectsRestore")}
          </Button>
        ) : (
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            {t("projectsDelete")}
          </Button>
        )}
        <Button
          onClick={() => void save()}
          disabled={!title.trim() || actions.updateItem.isPending}
        >
          {t("save")}
        </Button>
      </SheetFooter>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("projectsDeleteWorkItem")}
        description={t("projectsDeleteWorkItemDescription")}
        confirmLabel={t("projectsDelete")}
        variant="destructive"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          void runAction(() => actions.deleteItem.mutateAsync(item.id), onClose)
        }
      />
    </>
  );
}

function joinProjectPath(rootPath: string, relativePath: string): string {
  const separator =
    rootPath.endsWith("/") || rootPath.endsWith("\\") ? "" : "/";
  return `${rootPath}${separator}${relativePath}`;
}
