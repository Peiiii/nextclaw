import { useEffect, useState } from "react";
import { navigateResource, navigateWorkspace } from "@/app/workspace-router";
import { Check } from "lucide-react";
import type { BiboInboxItem } from "@nextclaw/bibo-client";
import { Button, EmptyState, ListRow, LoadingState, Markdown, Notice, SegmentedControl } from "@nextclaw/personal-agent-ui";
import { workspaceResources } from "@/features/space/managers/workspace-resource.manager";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { datetime, inboxTime } from "@/features/space/utils/date-format.utils";
import { inboxExcerpt, inboxReadingBody } from "@/features/space/utils/inbox-content.utils";
import { biboCopy as copy } from "@/shared/configs/bibo-copy.config";
export function Inbox({ onOpenSession }: { onOpenSession: (id: string) => Promise<void> }) {
  const { inbox, selectedInboxId, inboxSelection, inboxReadError, inboxReading, inboxReader, act, saving, cursors, moreLoading, loadMore, error } = useBiboSpaceStore();
  const [openingSource, setOpeningSource] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [actionFailure, setActionFailure] = useState("");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const { inboxScope } = useBiboSpaceStore();
  const selected = inbox.find((item) => item.id === selectedInboxId) ?? inboxSelection;
  const update = async () => {
    if (!selected) return;
    const accountId = useBiboSpaceStore.getState().accountId;
    setActionFailure("");
    const result = await act("inbox.resolve", { id: selected.id, version: selected.version }, "inbox");
    const current = useBiboSpaceStore.getState();
    if (!result && current.accountId === accountId && current.selectedInboxId === selected.id) setActionFailure(current.actionError);
  };
  const source = async (item: BiboInboxItem) => {
    if (!item.source.id) return;
    const accountId = useBiboSpaceStore.getState().accountId;
    setSourceError("");
    setOpeningSource(true);
    try {
      const current = useBiboSpaceStore.getState();
      if (current.accountId !== accountId || current.view !== "inbox" || current.selectedInboxId !== item.id) return;
      if (item.source.kind === "task") {
        navigateResource(`/tasks/${encodeURIComponent(item.source.id)}`);
      }
      if (item.source.kind === "event") {
        navigateResource(`/calendar/${encodeURIComponent(item.source.id)}`);
      }
      if (item.source.kind === "file") {
        navigateResource(`/files/${encodeURIComponent(item.source.id)}`);
      }
      if (item.source.kind === "session") {
        navigateWorkspace("chat");
        await onOpenSession(item.source.id);
      }
    } catch (error) {
      const current = useBiboSpaceStore.getState();
      if (current.accountId === accountId && current.view === "inbox" && current.selectedInboxId === item.id) {
        setSourceError(error instanceof Error ? error.message : "暂时无法读取来源，请重试。");
      }
    } finally { setOpeningSource(false); }
  };
  return (
    <div className="bibo-page workspace-page">
      <div className={`bibo-split inbox-layout${selectedInboxId ? " is-detail-open" : ""}`}>
        <div className="bibo-list-pane">
          <div className="bibo-pane-label"><SegmentedControl label="收件箱范围" value={inboxScope} options={[{ value: "pending", label: "待处理" }, { value: "unread", label: "未读" }, { value: "all", label: "全部" }]} onChange={inboxReader.scope} /></div>
          {inbox.length ? (
            inbox.map((item) => (
              <InboxItemRow key={item.id} item={item} now={now} selected={selected?.id === item.id}
                onClick={() => { setSourceError(""); setActionFailure(""); inboxReader.select(item.id); }} />
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
                <Button className="inbox-back" tone="text" onClick={() => { setSourceError(""); setActionFailure(""); inboxReader.select(null); }}>
                  {copy.inboxBack}
                </Button>
                <div className="bibo-action-row inbox-actions">
                  {!selected.readAt && inboxReadError?.id === selected.id && (
                    <Button
                      tone="secondary"
                      disabled={saving || inboxReading[selected.id]}
                      onClick={() => void inboxReader.read(selected)}
                    >
                      {copy.inboxReadRetry}
                    </Button>
                  )}
                  {!selected.resolvedAt && (
                    <Button
                      tone="primary"
                      disabled={saving || inboxReading[selected.id]}
                      onClick={() => void update()}
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
              {inboxReadError?.id === selected.id && <div className="inbox-detail-feedback"><Notice tone="error">{inboxReadError.message}</Notice></div>}
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
                    <Markdown text={inboxReadingBody(selected.body, selected.title)} resolveResourceHref={workspaceResources.href} />
                  </div>
                </article>
              </div>
            </>
          ) : (
            selectedInboxId ? <><Button className="inbox-back" tone="text" onClick={() => inboxReader.select(null)}>{copy.inboxBack}</Button>{error ? <><Notice tone="error">{error}</Notice><Button onClick={workspaceResources.retryRoute}>重试打开</Button></> : <LoadingState label={copy.resourceLoading} />}</> : <EmptyState title="选择一条消息" />
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
