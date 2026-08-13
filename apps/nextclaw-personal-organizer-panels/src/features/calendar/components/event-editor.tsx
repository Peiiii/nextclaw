import { CalendarDays, Clock3, ExternalLink, MapPin, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@shared/components/button";
import { Dialog } from "@shared/components/dialog";
import type { CalendarEventDraft } from "@shared/types/personal-organizer.types";
import { createDefaultEventTimes, toLocalDateTimeValue, toLocalDateValue } from "@shared/utils/date.utils";
import { calendarPresenter } from "@/features/calendar/presenters/calendar.presenter";
import { useCalendarStore } from "@/features/calendar/stores/calendar.store";

const emptyDraft = (dayKey: string): CalendarEventDraft => {
  const times = createDefaultEventTimes(dayKey);
  return { title: "", start: times.start, end: times.end, allDay: false, location: "", notes: "" };
};

export function EventEditor() {
  const { eventDialogOpen, eventDialogItemId, selectedDay, eventPending, closeEventDialog, items } = useCalendarStore();
  const item = items.find((entry) => entry.id === eventDialogItemId);
  const readOnly = item?.source === "ics";
  const [draft, setDraft] = useState<CalendarEventDraft>(() => item ? {
    title: item.title,
    start: item.allDay ? toLocalDateValue(item.start) : toLocalDateTimeValue(item.start),
    end: item.allDay ? toLocalDateValue(item.end || item.start) : toLocalDateTimeValue(item.end || item.start),
    allDay: item.allDay,
    location: item.location,
    notes: item.notes,
  } : emptyDraft(selectedDay));
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const setAllDay = (allDay: boolean) => {
    setDraft((current) => ({
      ...current,
      allDay,
      start: allDay ? current.start.slice(0, 10) : `${current.start.slice(0, 10)}T09:00`,
      end: allDay ? current.end.slice(0, 10) : `${current.end.slice(0, 10)}T10:00`,
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    const title = draft.title.trim();
    if (!title) return;
    const start = draft.allDay ? new Date(`${draft.start}T00:00:00`).toISOString() : new Date(draft.start).toISOString();
    const endDate = draft.allDay ? new Date(`${draft.end}T23:59:59.999`).toISOString() : new Date(draft.end).toISOString();
    await calendarPresenter.manager.saveEvent({ ...draft, title, location: draft.location.trim(), notes: draft.notes.trim(), start, end: endDate }, item?.id);
  };

  if (readOnly && item) {
    return (
      <Dialog open={eventDialogOpen} title={item.title} description={item.subscriptionName ? `来自 ${item.subscriptionName}` : "来自外部日历"} onClose={closeEventDialog}>
        <div className="space-y-4 p-5 text-sm">
          <div className="flex items-start gap-3"><Clock3 className="mt-0.5 text-[var(--muted)]" size={17} /><div><p className="font-medium">{new Date(item.start).toLocaleString("zh-CN")}</p><p className="mt-0.5 text-xs text-[var(--muted)]">外部日程请在原日历中修改</p></div></div>
          {item.location ? <div className="flex items-start gap-3"><MapPin className="mt-0.5 text-[var(--muted)]" size={17} /><p>{item.location}</p></div> : null}
          {item.notes ? <p className="whitespace-pre-wrap rounded-xl bg-[var(--surface-muted)] p-3 leading-6 text-[var(--muted)]">{item.notes}</p> : null}
          <Button tone="secondary" icon={<ExternalLink size={15} />} className="w-full" onClick={closeEventDialog}>知道了</Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open={eventDialogOpen} title={item ? "编辑日程" : "添加日程"} initialFocusSelector="#event-title" onClose={() => !eventPending && closeEventDialog()}>
      <form className="p-5" onSubmit={submit}>
        <label className="block text-xs font-semibold text-[var(--muted)]" htmlFor="event-title">标题</label>
        <input id="event-title" required maxLength={180} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-transparent px-3.5 py-3 text-[15px] outline-none focus:border-[var(--line-strong)]" placeholder="这段时间做什么" />
        <label className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-muted)] px-3.5 py-3 text-sm"><span>全天</span><input type="checkbox" checked={draft.allDay} onChange={(event) => setAllDay(event.target.checked)} className="h-4 w-4 accent-[var(--text)]" /></label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className="block text-xs font-semibold text-[var(--muted)]" htmlFor="event-start">开始</label><div className="relative mt-2"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" size={16} /><input id="event-start" required type={draft.allDay ? "date" : "datetime-local"} value={draft.start} onChange={(event) => setDraft((current) => ({ ...current, start: event.target.value }))} className="w-full rounded-xl border border-[var(--line)] bg-transparent py-2.5 pl-9 pr-2 text-sm outline-none focus:border-[var(--line-strong)]" /></div></div>
          <div><label className="block text-xs font-semibold text-[var(--muted)]" htmlFor="event-end">结束</label><div className="relative mt-2"><Clock3 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" size={16} /><input id="event-end" required type={draft.allDay ? "date" : "datetime-local"} value={draft.end} onChange={(event) => setDraft((current) => ({ ...current, end: event.target.value }))} className="w-full rounded-xl border border-[var(--line)] bg-transparent py-2.5 pl-9 pr-2 text-sm outline-none focus:border-[var(--line-strong)]" /></div></div>
        </div>
        <label className="mt-4 block text-xs font-semibold text-[var(--muted)]" htmlFor="event-location">地点</label>
        <div className="relative mt-2"><MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" size={16} /><input id="event-location" maxLength={180} value={draft.location} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} className="w-full rounded-xl border border-[var(--line)] bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--line-strong)]" placeholder="可选" /></div>
        <label className="mt-4 block text-xs font-semibold text-[var(--muted)]" htmlFor="event-notes">备注</label>
        <textarea id="event-notes" rows={3} maxLength={2000} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} className="mt-2 w-full resize-y rounded-xl border border-[var(--line)] bg-transparent px-3.5 py-3 text-sm leading-6 outline-none focus:border-[var(--line-strong)]" placeholder="补充议题、链接或准备事项" />
        <footer className="mt-5 flex min-h-10 items-center justify-between gap-3">
          {item ? deleteConfirm ? <div className="flex items-center gap-2"><span className="text-xs text-[var(--danger)]">确认删除？</span><Button tone="danger" disabled={eventPending} onClick={() => void calendarPresenter.manager.deleteEvent(item.id)}>删除</Button><Button tone="ghost" disabled={eventPending} onClick={() => setDeleteConfirm(false)}>取消</Button></div> : <Button tone="ghost" icon={<Trash2 size={16} />} disabled={eventPending} onClick={() => setDeleteConfirm(true)}>删除</Button> : <span />}
          <div className="flex gap-2"><Button tone="ghost" disabled={eventPending} onClick={closeEventDialog}>取消</Button><Button type="submit" tone="primary" disabled={eventPending || !draft.title.trim()}>{eventPending ? "保存中…" : "保存"}</Button></div>
        </footer>
      </form>
    </Dialog>
  );
}
