import { useState } from "react";
import type { BiboTask, BiboProject } from "@nextclaw/bibo-client";
import {
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  ListRow,
  SegmentedControl,
  Select,
} from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { datetime } from "@/features/space/utils/date-format.utils";
import { X } from "lucide-react";
import { TaskForm } from "./task-form";

export function Tasks() {
  const {
    tasks,
    projects,
    selectedTaskId,
    taskSelection,
    selectTask,
    taskQuery,
    taskProject: project,
    filterTasks,
    cursors,
    moreLoading,
    loadMore,
  } = useBiboSpaceStore();
  const [mode, setMode] = useState<"list" | "board">("list");
  const [projectEditor, setProjectEditor] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const visible = tasks.filter(
    (task) => !project || task.projectId === project
  );
  const selected = creating
    ? null
    : tasks.find((task) => task.id === selectedTaskId) ??
      (taskSelection?.id === selectedTaskId ? taskSelection : null);
  const card = (task: BiboTask) => (
    <TaskRow
      key={task.id}
      task={task}
      projectName={projects.find((item) => item.id === task.projectId)?.name}
      selected={selected?.id === task.id}
      onSelect={() => {
        selectTask(task.id);
        setCreating(false);
      }}
    />
  );
  return (
    <div className="bibo-page workspace-page">
      <TaskToolbar
        mode={mode}
        onChangeMode={setMode}
        onProjectEdit={setProjectEditor}
        onCreate={() => {
          setCreating(true);
          selectTask(null);
        }}
      />
      {projectEditor && (
        <ProjectForm
          key={projectEditor}
          project={projects.find((item) => item.id === projectEditor) ?? null}
          onDone={() => setProjectEditor(null)}
        />
      )}
      <div
        className={`bibo-split bibo-task-layout${
          creating || selected ? " is-detail-open" : ""
        }`}
      >
        <div className="bibo-list-pane">
          {visible.length ? (
            mode === "list" ? (
              visible.map(card)
            ) : (
              <div className="bibo-board">
                {(["planned", "active", "done", "cancelled"] as const).map(
                  (status) => (
                    <section key={status}>
                      <h3>
                        {status === "planned"
                          ? "待开始"
                          : status === "active"
                          ? "进行中"
                          : status === "done"
                          ? "已完成"
                          : "已取消"}{" "}
                        <small>
                          {
                            visible.filter((task) => task.status === status)
                              .length
                          }
                        </small>
                      </h3>
                      {visible
                        .filter((task) => task.status === status)
                        .map(card)}
                    </section>
                  )
                )}
              </div>
            )
          ) : (
            <>
              <EmptyState
                title={
                  taskQuery || project ? "没有匹配的任务" : "这里还没有任务"
                }
                detail={
                  taskQuery || project
                    ? "试试其它关键词或项目。"
                    : "写下下一步，Bibo 才能与你一起推进。"
                }
              />
              {(taskQuery || project) && (
                <Button tone="text" onClick={() => filterTasks("", "")}>
                  清除筛选
                </Button>
              )}
            </>
          )}
          {cursors.tasks && (
            <Button tone="text" className="bibo-load-more" disabled={moreLoading.tasks} onClick={() => void loadMore("tasks")}>
              {moreLoading.tasks ? "正在加载…" : "加载更多任务"}
            </Button>
          )}
        </div>
        {(creating || selected) && (
          <div className="bibo-detail-pane task-detail-pane">
            <div className="workspace-detail-head">
              <h2>{creating ? "新任务" : "任务详情"}</h2>
              <IconButton
                label="返回任务"
                icon={<X />}
                onClick={() => {
                  setCreating(false);
                  selectTask(null);
                }}
              />
            </div>
            <TaskForm
              key={selected?.id ?? "new"}
              task={selected}
              onDone={(savedId) => {
                setCreating(false);
                selectTask(savedId ?? null);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TaskToolbar({
  mode,
  onChangeMode,
  onCreate,
  onProjectEdit,
}: {
  mode: "list" | "board";
  onChangeMode: (mode: "list" | "board") => void;
  onCreate: () => void;
  onProjectEdit: (id: string) => void;
}) {
  const {
    projects,
    taskQuery,
    taskProject: project,
    filterTasks,
  } = useBiboSpaceStore();
  const setProject = (value: string) => filterTasks(taskQuery, value);
  return (
    <div className="bibo-filterbar workspace-toolbar">
      <Button tone="primary" onClick={onCreate}>
        ＋ 新任务
      </Button>
      <Input
        aria-label="搜索任务"
        placeholder="搜索名称或描述"
        value={taskQuery}
        onChange={(event) => filterTasks(event.target.value, project)}
      />
      <Select
        aria-label="按项目筛选"
        value={project}
        onChange={(event) => setProject(event.target.value)}
      >
        <option value="">所有项目</option>
        {projects.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </Select>
      <Button tone="text" onClick={() => onProjectEdit("new")}>
        ＋ 项目
      </Button>
      {project && (
        <Button
          tone="text"
          onClick={() => {
            onProjectEdit(project);
          }}
        >
          管理项目
        </Button>
      )}
      <span className="bibo-filter-spacer" />
      <SegmentedControl
        label="任务视图"
        value={mode}
        options={[
          { value: "list", label: "列表" },
          { value: "board", label: "看板" },
        ]}
        onChange={onChangeMode}
      />
    </div>
  );
}

function ProjectForm({
  project,
  onDone,
}: {
  project: BiboProject | null;
  onDone: () => void;
}) {
  const { act, saving, filterTasks, taskQuery } = useBiboSpaceStore();
  const [name, setName] = useState(project?.name ?? "");
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState("");
  const save = async () => {
    if (saving || !name.trim()) return;
    setFailure("");
    const result = await act(
      project ? "project.update" : "project.create",
      {
        name: name.trim(),
        ...(project ? { id: project.id, version: project.version } : {}),
      },
      "tasks"
    );
    if (result) onDone();
    else setFailure(useBiboSpaceStore.getState().error);
  };
  const remove = async () => {
    if (!project || saving) return;
    setFailure("");
    const result = await act(
      "project.delete",
      { id: project.id, version: project.version },
      "tasks"
    );
    if (result) {
      filterTasks(taskQuery, "");
      onDone();
    } else setFailure(useBiboSpaceStore.getState().error);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onDone();
      }}
      title={project ? "编辑项目" : "新建项目"}
      closeLabel="关闭项目操作"
      busy={saving}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Field label="项目名称">
          <Input
            disabled={saving}
            name="projectName"
            aria-label="项目名称"
            required
            placeholder="项目名称"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        {failure && (
          <p className="ui-overlay__error" role="alert">
            {failure}
          </p>
        )}
        <div className="ui-overlay__actions">
          <Button
            tone="primary"
            type="submit"
            disabled={saving || !name.trim()}
          >
            {project ? "保存名称" : "创建"}
          </Button>
          {project && (
            <Button
              tone="danger"
              type="button"
              disabled={saving}
              onClick={() => { setFailure(""); setDeleting(true); }}
            >
              删除项目
            </Button>
          )}
          <Button tone="text" type="button" disabled={saving} onClick={onDone}>
            取消
          </Button>
        </div>
      </form>
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title="删除项目？"
        description={`「${project?.name ?? ""}」将被删除。所属任务会保留，并移至未归入项目。`}
        cancelLabel="取消" confirmLabel="删除项目" busyLabel="正在删除…"
        busy={saving} error={failure} onConfirm={() => void remove()} />
    </Dialog>
  );
}

function TaskRow({
  task,
  projectName,
  selected,
  onSelect,
}: {
  task: BiboTask;
  projectName?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const statusLabel = {
    planned: "待开始",
    active: "进行中",
    done: "已完成",
    cancelled: "已取消",
  }[task.status];
  return (
    <ListRow
      key={task.id}
      className="bibo-task-row"
      selected={selected}
      onClick={onSelect}
    >
      <span className="bibo-task-state" aria-hidden="true">
        {task.status === "done"
          ? "✓"
          : task.status === "active"
          ? "◐"
          : task.status === "cancelled"
          ? "−"
          : "○"}
      </span>
      <span>
        <strong>{task.title}</strong>
        <small>
          {projectName ? `${projectName} · ` : ""}
          {task.priority === "high"
            ? "高优先级 · "
            : task.priority === "low"
            ? "低优先级 · "
            : ""}
          {task.dueAt ? `截止 ${datetime(task.dueAt)}` : "没有截止时间"}
          {task.subtasks.length
            ? ` · ${task.subtasks.filter((part) => part.done).length}/${
                task.subtasks.length
              } 步`
            : ""}
        </small>
      </span>
      <span className="bibo-task-status-label">{statusLabel}</span>
    </ListRow>
  );
}
