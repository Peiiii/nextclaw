import { useState, type FormEvent } from "react";
import type { BiboEvent } from "@nextclaw/bibo-client";
import { Button, ConfirmDialog, Field, Input, Textarea } from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { localInput } from "@/features/space/utils/date-format.utils";

export function EventForm({
  event,
  onDone,
  date = new Date(),
  slot,
}: {
  event: BiboEvent | null;
  onDone: () => void;
  date?: Date;
  slot: Date | null;
}) {
  const { act, events, saving, eventDrafts, keepEventDraft, clearEventDraft } = useBiboSpaceStore();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const remove = async () => {
    if (!event || saving) return;
    setDeleteError("");
    const result = await act("event.delete", { id: event.id, version: event.version }, "calendar");
    if (result) { setDeleting(false); finish(); }
    else setDeleteError(useBiboSpaceStore.getState().error);
  };
  const draftKey = event?.id ?? `new-${slot?.toISOString() ?? date.toDateString()}`;
  const initialStart = new Date(date);
  initialStart.setHours(
    date.toDateString() === new Date().toDateString() ? Math.min(23, Math.max(9, new Date().getHours() + 1)) : 9,
    0,
    0,
    0,
  );
  if (slot) initialStart.setTime(slot.getTime());
  const initialEnd = new Date(initialStart.getTime() + 60 * 60_000);
  const draft = eventDrafts[draftKey] ?? {
    title: event?.title ?? "",
    description: event?.description ?? "",
    version: event?.version ?? null,
    startAt: event ? localInput(event.startAt) : localInput(initialStart.toISOString()),
    endAt: event ? localInput(event.endAt) : localInput(initialEnd.toISOString()),
  };
  const { title, description, startAt, endAt, version } = draft;
  const startTime = new Date(startAt).getTime();
  const endTime = new Date(endAt).getTime();
  const validTimes = Number.isFinite(startTime) && Number.isFinite(endTime) && endTime > startTime;
  const change = <Key extends keyof typeof draft>(key: Key, value: (typeof draft)[Key]) =>
    keepEventDraft(draftKey, { ...draft, [key]: value });
  const changeStart = (value: string) => {
    const next = new Date(value).getTime();
    const duration = validTimes ? endTime - startTime : 60 * 60_000;
    keepEventDraft(draftKey, { ...draft, startAt: value, endAt: Number.isFinite(next) ? localInput(new Date(next + duration).toISOString()) : endAt });
  };
  const finish = () => {
    clearEventDraft(draftKey);
    onDone();
  };
  const overlap =
    validTimes
      ? events.filter(
          (item) =>
            item.id !== event?.id &&
            item.startAt < new Date(endAt).toISOString() &&
            item.endAt > new Date(startAt).toISOString(),
        )
      : [];
  const submit = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (saving || !title.trim() || !validTimes) return;
    const input = {
      title: title.trim(),
      description,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
    };
    const result = event
      ? await act("event.update", { ...input, id: event.id, version }, "calendar")
      : await act("event.create", input, "calendar");
    if (result) finish();
  };
  return (
    <form className="bibo-editor-form event-editor" onSubmit={(value) => void submit(value)}
      onKeyDown={(value) => { if (value.key === "Enter" && value.nativeEvent.isComposing) value.preventDefault(); }}>
      <h2>{event ? "日程详情" : "新日程"}</h2>
      <Field label="标题">
        <Input
          autoFocus
          disabled={saving}
          required
          maxLength={160}
          value={title}
          onChange={(value) => change("title", value.target.value)}
          placeholder="为这段时间起个名字"
        />
      </Field>
      <div className="bibo-form-pair">
        <Field label="开始">
          <Input
            required
            disabled={saving}
            type="datetime-local"
            value={startAt}
            onChange={(value) => changeStart(value.target.value)}
          />
        </Field>
        <Field label="结束">
          <Input
            required
            disabled={saving}
            type="datetime-local"
            value={endAt}
            onChange={(value) => change("endAt", value.target.value)}
          />
        </Field>
      </div>
      <div className="event-duration" role="group" aria-label="日程时长">
        {[30, 60, 90].map((minutes) => <Button key={minutes} type="button" tone="text" disabled={saving || !Number.isFinite(startTime)}
          aria-pressed={endTime - startTime === minutes * 60_000}
          onClick={() => change("endAt", localInput(new Date(startTime + minutes * 60_000).toISOString()))}>{minutes} 分钟</Button>)}
      </div>
      {startAt && endAt && !validTimes && <p role="alert" className="bibo-conflict">结束时间必须晚于开始时间。</p>}
      {overlap.length > 0 && (
        <p className="bibo-conflict">这段时间已有 {overlap.map((item) => item.title).join("、")}；保存前请确认安排。</p>
      )}
      <EventDescription value={description} disabled={saving} onChange={(value) => change("description", value)} />
      <div className="bibo-action-row">
        <Button tone="primary" type="submit" disabled={saving || !title.trim() || !validTimes}>
          {saving ? "正在保存…" : "保存日程"}
        </Button>
        <Button tone="text" type="button" disabled={saving} onClick={finish}>
          取消
        </Button>
        {event && (
          <Button
            tone="danger"
            type="button"
            disabled={saving}
            onClick={() => { setDeleteError(""); setDeleting(true); }}
          >
            删除日程
          </Button>
        )}
      </div>
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title="删除日程？"
        description={`「${event?.title ?? ""}」将从日历中删除，此操作目前不可撤销。`}
        cancelLabel="取消" confirmLabel="删除日程" busyLabel="正在删除…"
        busy={saving} error={deleteError} onConfirm={() => void remove()} />
    </form>
  );
}

function EventDescription({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(Boolean(value));
  return <>
    <Button tone="text" type="button" disabled={disabled} aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? "收起说明" : "添加说明"}
    </Button>
    {open && <Field label="说明"><Textarea rows={5} disabled={disabled} value={value}
      onChange={(event) => onChange(event.target.value)} placeholder="地点、准备事项或背景" /></Field>}
  </>;
}
