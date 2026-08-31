import { useState } from "react";
import type {
  ProjectWorkState,
  ProjectWorkStateCategory,
} from "@nextclaw/client-sdk";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { t } from "@/shared/lib/i18n";
import {
  sortProjectWorkStates,
  useProjectWorkActions,
} from "@/features/projects/hooks/use-project-work";

const CATEGORIES: ProjectWorkStateCategory[] = [
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
];

export function ProjectWorkStateSettings({
  open,
  onOpenChange,
  projectId,
  states,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  states: ProjectWorkState[];
}) {
  const actions = useProjectWorkActions(projectId);
  const sorted = sortProjectWorkStates(states);
  const [name, setName] = useState("");
  const [category, setCategory] =
    useState<ProjectWorkStateCategory>("unstarted");
  const [deleting, setDeleting] = useState<ProjectWorkState | null>(null);
  const [migrateToStateId, setMigrateToStateId] = useState<string>("");
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("projectsWorkActionFailed"),
      );
    }
  };
  const create = async () => {
    if (!name.trim()) return;
    await run(async () => {
      await actions.createState.mutateAsync({ name: name.trim(), category });
      setName("");
    });
  };
  const move = async (index: number, direction: -1 | 1) => {
    const current = sorted[index];
    const target = sorted[index + direction];
    if (!current || !target) return;
    await run(async () => {
      await actions.updateState.mutateAsync({
        stateId: current.id,
        patch: { position: target.position },
      });
      await actions.updateState.mutateAsync({
        stateId: target.id,
        patch: { position: current.position },
      });
    });
  };
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("projectsWorkStateSettings")}</DialogTitle>
            <DialogDescription>
              {t("projectsWorkStateSettingsDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {sorted.map((state, index) => (
              <div
                key={state.id}
                className="grid gap-2 rounded-xl border border-border/60 p-3 sm:grid-cols-[1fr_11rem_auto]"
              >
                <Input
                  aria-label={t("projectsWorkStateName")}
                  defaultValue={state.name}
                  onBlur={(event) => {
                    const nextName = event.currentTarget.value.trim();
                    if (nextName && nextName !== state.name)
                      void run(() =>
                        actions.updateState.mutateAsync({
                          stateId: state.id,
                          patch: { name: nextName },
                        }),
                      );
                  }}
                />
                <Select
                  value={state.category}
                  onValueChange={(value) =>
                    void run(() =>
                      actions.updateState.mutateAsync({
                        stateId: state.id,
                        patch: { category: value as ProjectWorkStateCategory },
                      }),
                    )
                  }
                >
                  <SelectTrigger aria-label={t("projectsWorkStateCategory")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`projectsWorkCategory_${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t("projectsMoveUp")}
                    disabled={index === 0}
                    onClick={() => void move(index, -1)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t("projectsMoveDown")}
                    disabled={index === sorted.length - 1}
                    onClick={() => void move(index, 1)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t("projectsDeleteState")}
                    disabled={sorted.length <= 1}
                    onClick={() => {
                      setDeleting(state);
                      setMigrateToStateId("");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-3">
                  <input
                    type="radio"
                    name="default-state"
                    checked={state.isDefault}
                    onChange={() =>
                      void run(() =>
                        actions.updateState.mutateAsync({
                          stateId: state.id,
                          patch: { isDefault: true },
                        }),
                      )
                    }
                  />
                  {t("projectsWorkDefaultState")}
                </label>
              </div>
            ))}
          </div>
          <div className="grid gap-2 border-t border-border/60 pt-4 sm:grid-cols-[1fr_11rem_auto]">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("projectsWorkNewState")}
            />
            <Select
              value={category}
              onValueChange={(value) =>
                setCategory(value as ProjectWorkStateCategory)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`projectsWorkCategory_${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => void create()}
              disabled={!name.trim() || actions.createState.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("projectsAdd")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(next) => {
          if (!next) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("projectsDeleteState")}</DialogTitle>
            <DialogDescription>
              {t("projectsDeleteStateDescription")}
            </DialogDescription>
          </DialogHeader>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">
              {t("projectsWorkStateMigration")}
            </p>
            <Select
              value={migrateToStateId}
              onValueChange={setMigrateToStateId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("projectsWorkStateMigrationOptional")}
                />
              </SelectTrigger>
              <SelectContent>
                {sorted
                  .filter((state) => state.id !== deleting?.id)
                  .map((state) => (
                    <SelectItem key={state.id} value={state.id}>
                      {state.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting)
                  void run(async () => {
                    await actions.deleteState.mutateAsync({
                      stateId: deleting.id,
                      migrateToStateId: migrateToStateId || null,
                    });
                    setDeleting(null);
                  });
              }}
            >
              {t("projectsDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
