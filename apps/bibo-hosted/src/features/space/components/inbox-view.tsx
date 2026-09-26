import { useState } from "react";
import { BiboClient, BiboClientError, type BiboEvent, type BiboFileDetail, type BiboInboxItem, type BiboTask } from "@nextclaw/bibo-client";
import { Button, EmptyState, ListRow, Markdown, Notice } from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { day, datetime } from "@/features/space/utils/date-format.utils";
const sourceClient = new BiboClient();
export function Inbox({ onOpenSession }: { onOpenSession: (id: string) => Promise<void> }) {
  const { inbox, selectedInboxId, selectInbox, act, navigate, openFile, saving, cursors, moreLoading, loadMore } = useBiboSpaceStore();
  const [openingSource, setOpeningSource] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const selected = inbox.find((item) => item.id === selectedInboxId) ?? null;
  const source = async (item: BiboInboxItem) => {
    if (!item.source.id) return;
    const accountId = useBiboSpaceStore.getState().accountId;
    setSourceError("");
    setOpeningSource(true);
    try {
      let verified: BiboTask | BiboEvent | BiboFileDetail | undefined;
      if (item.source.kind === "task" || item.source.kind === "event" || item.source.kind === "file") {
        verified = await sourceClient.space(`${item.source.kind}.get`, { id: item.source.id });
      }
      const current = useBiboSpaceStore.getState();
      if (current.accountId !== accountId || current.view !== "inbox" || current.selectedInboxId !== item.id) return;
      if (item.source.kind === "task") {
        navigate("tasks");
        useBiboSpaceStore.getState().selectTask(item.source.id, verified as BiboTask);
      }
      if (item.source.kind === "event") {
        navigate("calendar");
        useBiboSpaceStore.getState().selectEvent(item.source.id, verified as BiboEvent);
      }
      if (item.source.kind === "file") {
        navigate("files");
        void openFile(item.source.id, verified as BiboFileDetail);
      }
      if (item.source.kind === "session") {
        navigate("chat");
        void onOpenSession(item.source.id);
      }
    } catch (error) {
      const current = useBiboSpaceStore.getState();
      if (current.accountId === accountId && current.view === "inbox" && current.selectedInboxId === item.id) {
        setSourceError(error instanceof BiboClientError && error.status === 404
          ? "来源已删除或无法访问。"
          : error instanceof Error ? error.message : "暂时无法读取来源，请重试。");
      }
    } finally { setOpeningSource(false); }
  };
  return (
    <div className="bibo-page workspace-page">
      <div className={`bibo-split inbox-layout${selected ? " is-detail-open" : ""}`}>
        <div className="bibo-list-pane">
          <div className="bibo-pane-label">全部 · {inbox.length}</div>
          {inbox.length ? (
            inbox.map((item) => (
              <ListRow key={item.id} selected={selected?.id === item.id} onClick={() => { setSourceError(""); selectInbox(item.id); }}>
                <span className={`bibo-unread-dot${item.readAt ? " is-read" : ""}`} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.resolvedAt ? "已处理 · " : item.readAt ? "已读 · " : "未读 · "}{item.body.slice(0, 85)}</small>
                </span>
                <time>{day(item.createdAt)}</time>
              </ListRow>
            ))
          ) : (
            <EmptyState title="现在很安静" />
          )}
          {cursors.inbox && (
            <Button tone="text" className="bibo-load-more" disabled={moreLoading.inbox} onClick={() => void loadMore("inbox")}>
              {moreLoading.inbox ? "正在加载…" : "加载更多消息"}
            </Button>
          )}
        </div>
        <div className="bibo-detail-pane">
          {selected ? (
            <>
              <Button tone="text" onClick={() => { setSourceError(""); selectInbox(null); }}>
                ← 全部消息
              </Button>
              <p className="bibo-kicker">
                {selected.kind === "decision" ? "待决定" : selected.kind === "reminder" ? "提醒" : "Bibo 送达"} ·{" "}
                {datetime(selected.createdAt)}
              </p>
              <h2>{selected.title}</h2>
              {sourceError && <Notice tone="error">{sourceError}</Notice>}
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
                  <Button tone="text" disabled={openingSource} onClick={() => void source(selected)}>
                    {openingSource ? "正在打开来源…" : "查看来源 ↗"}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <EmptyState title="选择一条消息" />
          )}
        </div>
      </div>
    </div>
  );
}
