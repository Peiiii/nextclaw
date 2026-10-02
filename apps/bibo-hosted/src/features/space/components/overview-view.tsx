import { Link } from "react-router";
import { navigateResource, navigateWorkspace, resourceHref } from "@/app/workspace-router";
import { EmptyState, ListRow } from "@nextclaw/personal-agent-ui";
import { biboCopy } from "@/shared/configs/bibo-copy.config";
import { BiboCompanion } from "@/shared/components/bibo-companion";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { day, datetime } from "@/features/space/utils/date-format.utils";
export function Overview() {
  const { overview } = useBiboSpaceStore();
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
  const hasActivity = Boolean(overview && (overview.inbox.length || overview.events.length || overview.tasks.length || overview.notes.length || overview.projects.length));
  const briefTarget = overview?.counts.unread ? "inbox" : overview?.counts.activeTasks ? "tasks" : "chat";
  const briefAction = briefTarget === "inbox" ? "看收件箱 ↗" : briefTarget === "tasks" ? "看任务 ↗" : "开始对话 ↗";
  return (
    <div className="bibo-page bibo-overview">
      <header className="bibo-page-title bibo-overview-welcome">
        <div>
          <p className="bibo-kicker">{day(new Date().toISOString())}</p>
          <h1>{`${greeting}，${hasActivity ? "最近你在忙这些。" : "今天从这里开始。"}`}</h1>
          <p>{biboCopy.overviewCompanion}</p>
        </div>
        <BiboCompanion className="bibo-overview-companion" />
      </header>
      {!overview ? (
        <EmptyState title="正在整理你的空间" />
      ) : (
        <div className="bibo-overview-grid">
          <Link className="bibo-overview-brief" to={`/${briefTarget}`}>
            <span className="bibo-overview-brief-copy">
              <strong>{overview.counts.unread
                ? `有 ${overview.counts.unread} 件事值得看一眼。`
                : overview.counts.activeTasks
                  ? `有 ${overview.counts.activeTasks} 件任务正在推进。`
                  : "今天可以从一件小事开始。"}</strong>
              <small>{overview.events[0]
                ? `接下来是 ${datetime(overview.events[0].startAt)} 的「${overview.events[0].title}」。`
                : "目前没有临近的日程。你可以先聊聊今天想推进什么。"}</small>
            </span>
            <span className="bibo-overview-brief-action">{briefAction}</span>
          </Link>
          <div className="bibo-overview-column">
            <section className="bibo-summary-card bibo-overview-inbox">
              <div className="bibo-card-heading">
                <span>收件箱</span>
                <small>{overview.counts.unread} 未读</small>
              </div>
              <h2>值得你留意</h2>
              {overview.inbox.length ? (
                overview.inbox.map((item) => (
                  <ListRow variant="card"
                    className="bibo-summary-row"
                    key={item.id}
                    onClick={() => {
                      navigateResource(`/inbox/${encodeURIComponent(item.id)}`);
                    }}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.readAt ? "已读" : "新"}</span>
                  </ListRow>
                ))
              ) : (
                <p className="bibo-card-empty">目前没有需要处理的消息。</p>
              )}
            </section>
            <OverviewProjects />
            <section className="bibo-summary-card bibo-overview-notes">
              <div className="bibo-card-heading">
                <span>笔记</span>
                <small>最近</small>
              </div>
              <h2>记下来的想法</h2>
              {overview.notes.length ? (
                overview.notes.map((file) => (
                  <ListRow variant="card"
                    className="bibo-summary-row"
                    key={file.id}
                    onClick={() => {
                      navigateResource(resourceHref("notes", file.id));
                    }}
                  >
                    <strong>{file.path.split("/").at(-1)}</strong>
                    <span>{day(file.updatedAt)}</span>
                  </ListRow>
                ))
              ) : (
                <p className="bibo-card-empty">一个念头，也值得留在这里。</p>
              )}
            </section>
          </div>
          <div className="bibo-overview-column">
            <section className="bibo-summary-card bibo-overview-calendar">
              <div className="bibo-card-heading">
                <span>日程</span>
                <small>近期</small>
              </div>
              <h2>留给这些时间</h2>
              {overview.events.length ? (
                overview.events.map((event) => (
                  <ListRow variant="card"
                    className="bibo-summary-row"
                    key={event.id}
                    onClick={() => {
                      navigateResource(`/calendar/${encodeURIComponent(event.id)}`);
                    }}
                  >
                    <span>{datetime(event.startAt)}</span>
                    <strong>{event.title}</strong>
                  </ListRow>
                ))
              ) : (
                <p className="bibo-card-empty">还没有安排。保持空白也很好。</p>
              )}
            </section>
            <section className="bibo-summary-card bibo-overview-tasks">
              <div className="bibo-card-heading">
                <span>任务</span>
                <small>{overview.counts.activeTasks} 进行中</small>
              </div>
              <h2>在推进的事</h2>
              {overview.tasks.length ? (
                overview.tasks.map((task) => (
                  <ListRow variant="card"
                    className="bibo-summary-row"
                    key={task.id}
                    onClick={() => {
                      navigateResource(`/tasks/${encodeURIComponent(task.id)}`);
                    }}
                  >
                    <strong>{task.title}</strong>
                    <span>{task.status === "active" ? "进行中" : "待开始"}</span>
                  </ListRow>
                ))
              ) : (
                <p className="bibo-card-empty">还没有任务。可以从一个清晰的下一步开始。</p>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewProjects() {
  const { overview, filterTasks } = useBiboSpaceStore();
  if (!overview) return null;
  return (
    <>
      {overview.projects.length > 0 && (
        <section className="bibo-summary-card bibo-project-card">
          <div className="bibo-card-heading">
            <span>正在推进的项目</span>
            <small>{overview.projects.length} 个</small>
          </div>
          <div className="bibo-project-list">
            {overview.projects.map((project) => (
              <ListRow variant="card" key={project.id}
                onClick={() => {
                  filterTasks("", project.id);
                  navigateWorkspace("tasks");
                }}
              >
                <strong>{project.name}</strong>
                <span>
                  {project.done} / {project.total} 完成
                </span>
                <i style={{ width: `${project.total ? (project.done / project.total) * 100 : 0}%` }} />
              </ListRow>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
