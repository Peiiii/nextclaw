import { AlertCircle, CheckCircle2, Link2, RefreshCw, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@shared/components/button";
import { Dialog } from "@shared/components/dialog";
import { IconButton } from "@shared/components/icon-button";
import { calendarPresenter } from "@/features/calendar/presenters/calendar.presenter";
import { useCalendarStore } from "@/features/calendar/stores/calendar.store";

export function CalendarSourcesDialog() {
  const { sourcesDialogOpen, closeSourcesDialog, subscriptions, sourcePendingId } = useCalendarStore();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await calendarPresenter.manager.subscribe(name.trim(), url.trim())) {
      setName(""); setUrl("");
    }
  };

  return (
    <Dialog open={sourcesDialogOpen} title="日历来源" description="连接公开的 ICS 订阅链接；链接与同步结果只保存在本机。" initialFocusSelector="#source-name" onClose={() => !sourcePendingId && closeSourcesDialog()}>
      <div className="border-b border-[var(--line)] p-5">
        <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">已连接</h3>{subscriptions.length ? <Button tone="ghost" icon={<RefreshCw className={sourcePendingId === "all" ? "animate-spin" : ""} size={15} />} className="min-h-9 text-xs" disabled={Boolean(sourcePendingId)} onClick={() => void calendarPresenter.manager.sync()}>全部同步</Button> : null}</div>
        {subscriptions.length ? (
          <div className="mt-3 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
            {subscriptions.map((source) => (
              <div key={source.id} className="flex items-start gap-3 px-3 py-3">
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${source.lastError ? "bg-[var(--danger-soft)] text-[var(--danger)]" : "bg-[var(--success-soft)] text-[var(--success)]"}`}>{source.lastError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{source.name}</p><p className={`mt-0.5 text-xs leading-5 ${source.lastError ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>{source.lastError || (source.lastSyncedAt ? `上次同步 ${new Date(source.lastSyncedAt).toLocaleString("zh-CN")}` : "尚未同步")}</p></div>
                {deleteId === source.id ? <div className="flex items-center gap-1"><Button tone="danger" className="min-h-9 px-2 text-xs" disabled={Boolean(sourcePendingId)} onClick={() => void calendarPresenter.manager.unsubscribe(source.id).then((ok) => ok && setDeleteId(null))}>确认</Button><IconButton label="取消移除" onClick={() => setDeleteId(null)}><Trash2 size={15} /></IconButton></div> : <div className="flex items-center"><IconButton label={`同步${source.name}`} disabled={Boolean(sourcePendingId)} onClick={() => void calendarPresenter.manager.sync(source.id)}><RefreshCw className={sourcePendingId === source.id ? "animate-spin" : ""} size={15} /></IconButton><IconButton label={`移除${source.name}`} tone="danger" disabled={Boolean(sourcePendingId)} onClick={() => setDeleteId(source.id)}><Trash2 size={15} /></IconButton></div>}
              </div>
            ))}
          </div>
        ) : <p className="mt-3 rounded-xl bg-[var(--surface-muted)] px-3 py-4 text-sm leading-6 text-[var(--muted)]">还没有连接外部日历。你也可以只使用本地日程。</p>}
      </div>
      <form className="p-5" onSubmit={submit}>
        <div className="mb-4 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--surface-muted)] text-[var(--muted)]"><Link2 size={16} /></span><h3 className="text-sm font-semibold">连接 ICS 日历</h3></div>
        <label className="block text-xs font-semibold text-[var(--muted)]" htmlFor="source-name">名称</label>
        <input id="source-name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-[var(--line-strong)]" placeholder="例如：工作日历" />
        <label className="mt-4 block text-xs font-semibold text-[var(--muted)]" htmlFor="source-url">ICS 订阅链接</label>
        <input id="source-url" required type="url" value={url} onChange={(event) => setUrl(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-[var(--line-strong)]" placeholder="https://…/calendar.ics" />
        <Button type="submit" tone="primary" className="mt-4 w-full" disabled={Boolean(sourcePendingId) || !name.trim() || !url.trim()}>{sourcePendingId === "new" ? "正在连接…" : "连接并同步"}</Button>
      </form>
    </Dialog>
  );
}
