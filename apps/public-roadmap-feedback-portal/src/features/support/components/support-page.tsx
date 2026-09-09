import { supportManager as manager } from "@/features/support/managers/support.manager";
import { useSupportStore } from "@/features/support/stores/support.store";
import { supportText as t } from "@/features/support/configs/support-messages.config";
import "./support-page.css";

export function SupportPage(): JSX.Element {
  const state = useSupportStore();
  const [page, setPage] = useState(0);
  useEffect(() => { document.title = t.heading + " · NextClaw"; }, []);
  const report = state.selected;
  return <main className="support-page">
    <header className="support-header"><a href="/">NextClaw</a></header>
    <h1>{t.heading}</h1>
    <p className="support-intro">{t.intro}</p>
    {state.error && <div className="support-error" role="alert">{state.error}</div>}
    {state.notice && <div className="support-notice" role="status">{state.notice}</div>}
    {report ? <section className="support-card">
      <button type="button" onClick={() => manager.patch({ selected: null })}>{t.back}</button>
      <div className="support-title"><h2>{report.title}</h2><span className="support-badge">{t.status[report.status]}</span></div>
      <p className="support-muted">{report.identity === "verified" ? t.verified : t.anonymous} · {new Date(report.createdAt).toLocaleString()}</p>
      <p className="support-body">{report.description}</p>
      {(report.version || report.environment) && <p className="support-body support-muted">{report.version} {report.environment}</p>}
      {report.release && <p><a href={report.release.url} target="_blank" rel="noreferrer">{t.published} {report.release.version} · {report.release.channel}</a></p>}
      <div className="support-actions">
        <button type="button" disabled={state.busy} onClick={() => void manager.open(report.id)}>{t.refresh}</button>
        <button type="button" onClick={() => manager.exportReceipt()}>{t.export}</button>
      </div>
      <p className="support-muted">{t.notice}</p>
      <ol className="support-messages">{report.messages.map((message) => <li key={message.id}>
        <strong>{message.role === "maintainer" ? t.maintainer : t.user}</strong><time>{new Date(message.createdAt).toLocaleString()}</time>
        <p className="support-body">{message.body}</p>
      </li>)}</ol>
      <form onSubmit={(event) => { event.preventDefault(); void manager.operate("reply"); }}>
        <label>{t.reply}<textarea rows={4} maxLength={4000} required value={state.reply} onChange={(e) => manager.patch({ reply: e.target.value })} /></label>
        <div className="support-actions"><button className="support-primary" disabled={state.busy || !state.reply.trim()}>{state.busy ? t.pending : t.send}</button>
          {report.status !== "withdrawn" && <button type="button" disabled={state.busy} onClick={() => { if (confirm(t.withdrawConfirm)) void manager.operate("withdraw"); }}>{t.withdraw}</button>}
        </div>
      </form>
    </section> : <div className="support-layout">
      <form className="support-card" onSubmit={(event) => { event.preventDefault(); void manager.submit(); }}>
        <label>{t.title}<input autoComplete="off" required maxLength={100} value={state.draft.title} onChange={(e) => manager.patchDraft("title", e.target.value)} /></label>
        <label>{t.description}<textarea required maxLength={8000} rows={7} value={state.draft.description} onChange={(e) => manager.patchDraft("description", e.target.value)} /></label>
        <label>{t.version}<input maxLength={100} value={state.draft.version} onChange={(e) => manager.patchDraft("version", e.target.value)} /></label>
        <label>{t.environment}<input maxLength={2000} value={state.draft.environment} onChange={(e) => manager.patchDraft("environment", e.target.value)} /></label>
        <p className="support-muted">{t.privacy}</p>
        <button className="support-primary" disabled={state.busy}>{state.busy ? t.pending : t.submit}</button>
      </form>
      <aside className="support-card"><h2>{t.mine}</h2>
        {state.receipts.length === 0 && <p className="support-muted">{t.empty}</p>}
        <ul className="support-receipts">{state.receipts.slice(page * 10, (page + 1) * 10).map((receipt) => <li key={receipt.id}><button type="button" disabled={state.busy} onClick={() => void manager.open(receipt.id)}>{receipt.title || receipt.id}</button></li>)}</ul>
        <div className="support-actions">{page > 0 && <button type="button" onClick={() => setPage(0)}>{t.first}</button>}{(page + 1) * 10 < state.receipts.length && <button type="button" onClick={() => setPage(page + 1)}>{t.next}</button>}</div>
        <label className="support-restore">{t.restore}<input type="file" accept=".json" aria-label={t.receipt} onChange={(e) => { const file = e.target.files?.[0]; if (file) void manager.restore(file); }} /></label>
      </aside>
    </div>}
  </main>;
}
import { useEffect, useState } from "react";
