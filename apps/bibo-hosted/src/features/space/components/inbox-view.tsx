import type { BiboInboxItem } from "@nextclaw/bibo-client";
import { Button, EmptyState, ListRow, Markdown } from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { day, datetime } from "@/features/space/utils/date-format.utils";
export function Inbox({ onOpenSession }: { onOpenSession: (id: string) => Promise<void> }) {
  const { inbox, selectedInboxId, selectInbox, act, navigate, openFile, saving } = useBiboSpaceStore();
  const selected = inbox.find((item) => item.id === selectedInboxId) ?? null;
  const source = (item: BiboInboxItem) => {
    if (!item.source.id) return;
    if (item.source.kind === "task") {
      navigate("tasks");
      useBiboSpaceStore.getState().selectTask(item.source.id);
    }
    if (item.source.kind === "event") {
      navigate("calendar");
      useBiboSpaceStore.getState().selectEvent(item.source.id);
    }
    if (item.source.kind === "file") {
      navigate("files");
      void openFile(item.source.id);
    }
    if (item.source.kind === "session") {
      navigate("chat");
      void onOpenSession(item.source.id);
    }
  };
  return (
    <div className="bibo-page workspace-page">
      <div className={`bibo-split inbox-layout${selected ? " is-detail-open" : ""}`}>
        <div className="bibo-list-pane">
          <div className="bibo-pane-label">全部 · {inbox.length}</div>
          {inbox.length ? (
            inbox.map((item) => (
              <ListRow key={item.id} selected={selected?.id === item.id} onClick={() => selectInbox(item.id)}>
                <span className={`bibo-unread-dot${item.readAt ? " is-read" : ""}`} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.resolvedAt ? "已处理 · " : item.readAt ? "已读 · " : "未读 · "}{item.body.slice(0, 85)}</small>
                </span>
                <time>{day(item.createdAt)}</time>
              </ListRow>
            ))
          ) : (
            <EmptyState title="现在很安静" detail="Bibo 有需要你留意的事，会放在这里。" />
          )}
        </div>
        <div className="bibo-detail-pane">
          {selected ? (
            <>
              <Button tone="text" onClick={() => selectInbox(null)}>
                ← 全部消息
              </Button>
              <p className="bibo-kicker">
                {selected.kind === "decision" ? "待决定" : selected.kind === "reminder" ? "提醒" : "Bibo 送达"} ·{" "}
                {datetime(selected.createdAt)}
              </p>
              <h2>{selected.title}</h2>
              {selected.resolvedAt && <p className="bibo-save-state">已处理 · {datetime(selected.resolvedAt)}</p>}
              <div className="bibo-readable">
                <Markdown text={selected.body} />
              </div>
              <div className="bibo-action-row">
                {!selected.readAt && (
                  <Button
                    tone="secondary"
                    disabled={saving}
                    onClick={() => void act("inbox.read", { id: selected.id, version: selected.version }, "inbox")}
                  >
                    标记已读
                  </Button>
                )}
                {!selected.resolvedAt && (
                  <Button
                    tone="primary"
                    disabled={saving}
                    onClick={() => void act("inbox.resolve", { id: selected.id, version: selected.version }, "inbox")}
                  >
                    已处理
                  </Button>
                )}
                {selected.source.kind !== "bibo" && selected.source.id && (
                  <Button tone="text" onClick={() => source(selected)}>
                    查看来源 ↗
                  </Button>
                )}
              </div>
            </>
          ) : (
            <EmptyState title="选择一条消息" detail="详情会在这里完整展开。" />
          )}
        </div>
      </div>
    </div>
  );
}
