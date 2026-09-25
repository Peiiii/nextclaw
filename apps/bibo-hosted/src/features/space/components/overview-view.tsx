import type { ReactNode } from "react";
import { EmptyState } from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { day, datetime } from "@/features/space/utils/date-format.utils";
function PageTitle({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="bibo-page-title">
      <div>
        <p className="bibo-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  );
}
export function Overview() {
  const { overview, navigate, selectInbox, selectTask, selectEvent, openFile } = useBiboSpaceStore();
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
  return (
    <div className="bibo-page bibo-overview">
      <PageTitle
        eyebrow={day(new Date().toISOString())}
        title={`${greeting}，今天从这里开始。`}
        detail="把值得留意的事放在眼前，其余的留给需要的时候。"
      />
      {!overview ? (
        <EmptyState title="正在整理你的空间" detail="载入后，这里只会显示真实的日程、任务和消息。" />
      ) : (
        <div className="bibo-overview-grid">
          <section className="bibo-summary-card bibo-summary-wide">
            <div className="bibo-card-heading">
              <span>✳ &nbsp; Bibo 简报</span>
              <small>现在</small>
            </div>
            <h2>
              {overview.counts.unread
                ? `有 ${overview.counts.unread} 件事值得看一眼。`
                : overview.counts.activeTasks
                  ? `有 ${overview.counts.activeTasks} 件任务正在推进。`
                  : "今天可以从一件小事开始。"}
            </h2>
            <p>
              {overview.events[0]
                ? `接下来是 ${datetime(overview.events[0].startAt)} 的「${overview.events[0].title}」。`
                : "目前没有临近的日程。你可以先聊聊今天想推进什么。"}
            </p>
          </section>
          <section className="bibo-summary-card">
            <div className="bibo-card-heading">
              <span>收件箱</span>
              <small>{overview.counts.unread} 未读</small>
            </div>
            <h2>值得你留意</h2>
            {overview.inbox.length ? (
              overview.inbox.map((item) => (
                <button
                  className="bibo-summary-row"
                  key={item.id}
                  onClick={() => {
                    navigate("inbox");
                    selectInbox(item.id);
                  }}
                >
                  <strong>{item.title}</strong>
                  <span>{item.readAt ? "已读" : "新"}</span>
                </button>
              ))
            ) : (
              <p className="bibo-card-empty">目前没有需要处理的消息。</p>
            )}
          </section>
          <section className="bibo-summary-card">
            <div className="bibo-card-heading">
              <span>日程</span>
              <small>近期</small>
            </div>
            <h2>留给这些时间</h2>
            {overview.events.length ? (
              overview.events.map((event) => (
                <button
                  className="bibo-summary-row"
                  key={event.id}
                  onClick={() => {
                    navigate("calendar");
                    selectEvent(event.id);
                  }}
                >
                  <span>{datetime(event.startAt)}</span>
                  <strong>{event.title}</strong>
                </button>
              ))
            ) : (
              <p className="bibo-card-empty">还没有安排。保持空白也很好。</p>
            )}
          </section>
          <section className="bibo-summary-card">
            <div className="bibo-card-heading">
              <span>任务</span>
              <small>{overview.counts.activeTasks} 进行中</small>
            </div>
            <h2>在推进的事</h2>
            {overview.tasks.length ? (
              overview.tasks.map((task) => (
                <button
                  className="bibo-summary-row"
                  key={task.id}
                  onClick={() => {
                    navigate("tasks");
                    selectTask(task.id);
                  }}
                >
                  <strong>{task.title}</strong>
                  <span>{task.status === "active" ? "进行中" : "待开始"}</span>
                </button>
              ))
            ) : (
              <p className="bibo-card-empty">还没有任务。可以从一个清晰的下一步开始。</p>
            )}
          </section>
          <section className="bibo-summary-card">
            <div className="bibo-card-heading">
              <span>笔记</span>
              <small>最近</small>
            </div>
            <h2>记下来的想法</h2>
            {overview.notes.length ? (
              overview.notes.map((file) => (
                <button
                  className="bibo-summary-row"
                  key={file.id}
                  onClick={() => {
                    navigate("notes");
                    void openFile(file.id);
                  }}
                >
                  <strong>{file.path.split("/").at(-1)}</strong>
                  <span>{day(file.updatedAt)}</span>
                </button>
              ))
            ) : (
              <p className="bibo-card-empty">一个念头，也值得留在这里。</p>
            )}
          </section>
          <OverviewProjects />
        </div>
      )}
    </div>
  );
}

function OverviewProjects() {
  const { overview, navigate, filterTasks } = useBiboSpaceStore();
  if (!overview) return null;
  return (
    <>
      {" "}
      {overview.projects.length > 0 && (
        <section className="bibo-summary-card bibo-project-card">
          <div className="bibo-card-heading">
            <span>正在推进的项目</span>
            <small>{overview.projects.length} 个</small>
          </div>
          <div className="bibo-project-list">
            {overview.projects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  filterTasks("", project.id);
                  navigate("tasks");
                }}
              >
                <strong>{project.name}</strong>
                <span>
                  {project.done} / {project.total} 完成
                </span>
                <i style={{ width: `${project.total ? (project.done / project.total) * 100 : 0}%` }} />
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
