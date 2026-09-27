import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { BiboClient, BiboClientError, type BiboEvent, type BiboFileDetail, type BiboInboxItem, type BiboTask } from "@nextclaw/bibo-client";
import { Button, EmptyState, ListRow, Markdown, Notice, SegmentedControl } from "@nextclaw/personal-agent-ui";
import { workspaceResources } from "@/features/space/managers/workspace-resource.manager";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { datetime, inboxTime } from "@/features/space/utils/date-format.utils";
import { inboxExcerpt, inboxReadingBody } from "@/features/space/utils/inbox-content.utils";
const sourceClient = new BiboClient();
export function Inbox({ onOpenSession }: { onOpenSession: (id: string) => Promise<void> }) {
  const { inbox, selectedInboxId, inboxSelection, selectInbox, act, navigate, openFile, saving, cursors, moreLoading, loadMore } = useBiboSpaceStore();
  const [openingSource, setOpeningSource] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [actionFailure, setActionFailure] = useState("");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const { inboxScope, setInboxScope } = useBiboSpaceStore();
  const selected = inbox.find((item) => item.id === selectedInboxId) ?? inboxSelection;
  const update = async (action: "inbox.read" | "inbox.resolve") => {
    if (!selected) return;
    const accountId = useBiboSpaceStore.getState().accountId;
    setActionFailure("");
    const result = await act(action, { id: selected.id, version: selected.version }, "inbox");
    const current = useBiboSpaceStore.getState();
    if (!result && current.accountId === accountId && current.selectedInboxId === selected.id) setActionFailure(current.actionError);
  };
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
          <div className="bibo-pane-label"><SegmentedControl label="收件箱范围" value={inboxScope} options={[{ value: "pending", label: "待处理" }, { value: "unread", label: "未读" }, { value: "all", label: "全部" }]} onChange={setInboxScope} /></div>
          {inbox.length ? (
            inbox.map((item) => (
              <InboxItemRow key={item.id} item={item} now={now} selected={selected?.id === item.id}
                onClick={() => { setSourceError(""); setActionFailure(""); selectInbox(item.id); }} />
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
        <div className="bibo-detail-pane inbox-detail">
          {selected ? (
            <>
              <div className="inbox-detail-toolbar">
                <Button className="inbox-back" tone="text" onClick={() => { setSourceError(""); setActionFailure(""); selectInbox(null); }}>
                  ← 全部消息
                </Button>
                <div className="bibo-action-row inbox-actions">
                  {!selected.readAt && (
                    <Button
                      tone="secondary"
                      disabled={saving}
                      onClick={() => void update("inbox.read")}
                    >
                      标记已读
                    </Button>
                  )}
                  {!selected.resolvedAt && (
                    <Button
                      tone="primary"
                      disabled={saving}
                      onClick={() => void update("inbox.resolve")}
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
              </div>
              {sourceError && <div className="inbox-detail-feedback"><Notice tone="error">{sourceError}</Notice></div>}
              {actionFailure && <div className="inbox-detail-feedback"><Notice tone="error">{actionFailure}</Notice></div>}
              <div className="inbox-reader" key={selected.id}>
                <article className="inbox-article">
                  <header className="inbox-article-heading">
                    <p className="bibo-kicker">
                      {selected.kind === "decision" ? "待决定" : selected.kind === "reminder" ? "提醒" : "Bibo 送达"} ·{" "}
                      <time dateTime={selected.createdAt}>{datetime(selected.createdAt)}</time>
                    </p>
                    <h1 className="inbox-title">{selected.title}</h1>
                    {selected.resolvedAt && <p className="bibo-save-state">已处理 · {datetime(selected.resolvedAt)}</p>}
                  </header>
                  <div className="bibo-readable">
                    <Markdown text={inboxReadingBody(selected.body, selected.title)} density="compact" resolveResourceHref={workspaceResources.href} />
                  </div>
                </article>
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

function InboxItemRow({ item, now, selected, onClick }: {
  item: BiboInboxItem; now: number; selected: boolean; onClick: () => void;
}) {
  const excerpt = inboxExcerpt(inboxReadingBody(item.body, item.title));
  return (
    <ListRow selected={selected} onClick={onClick}>
      <span className="inbox-item-copy">
        <span className="inbox-item-heading">
          <strong>{item.title}</strong>
          {item.resolvedAt ? (
            <span role="img" aria-label="已处理" className="inbox-item-resolved">
              <Check size={14} aria-hidden="true" />
            </span>
          ) : !item.readAt ? (
            <span role="img" aria-label="未读" className="inbox-item-unread" />
          ) : <span className="visually-hidden">已读</span>}
        </span>
        <span className="inbox-item-meta">
          {excerpt && <small>{excerpt}</small>}
          <time dateTime={item.createdAt} aria-label={new Date(item.createdAt).toLocaleString("zh-CN")}>
            {inboxTime(item.createdAt, now)}
          </time>
        </span>
      </span>
    </ListRow>
  );
}
