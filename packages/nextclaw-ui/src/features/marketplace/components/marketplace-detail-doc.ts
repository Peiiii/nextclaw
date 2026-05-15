function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildGenericDetailDataUrl(params: {
  title: string;
  typeLabel: string;
  spec: string;
  summary?: string;
  description?: string;
  metadataRaw?: string;
  contentRaw?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  tags?: string[];
  author?: string;
  loading?: boolean;
}): string {
  const {
    title,
    typeLabel,
    spec,
    summary: rawSummary,
    description: rawDescription,
    metadataRaw,
    contentRaw,
    sourceUrl,
    sourceLabel,
    tags,
    author,
    loading,
  } = params;
  const metadata = metadataRaw?.trim() || "-";
  const content = contentRaw?.trim() || "-";
  const summary = rawSummary?.trim();
  const description = rawDescription?.trim();
  const shouldShowDescription = Boolean(description) && description !== summary;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; background: #f7f8fa; color: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .wrap { max-width: 940px; margin: 0 auto; padding: 24px 20px 36px; }
      .hero { border: 1px solid #e5e7eb; border-radius: 14px; background: #ffffff; padding: 18px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
      .hero h1 { margin: 0; font-size: 22px; line-height: 1.2; letter-spacing: 0; }
      .meta { margin-top: 7px; color: #6b7280; font-size: 12px; overflow-wrap: anywhere; word-break: break-word; }
      .summary { margin: 12px 0 0; font-size: 13px; line-height: 1.65; color: #4b5563; }
      .grid { display: grid; grid-template-columns: minmax(220px, 0.42fr) minmax(0, 1fr); gap: 12px; margin-top: 12px; }
      .card { border: 1px solid #e5e7eb; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03); }
      .card h2 { margin: 0; padding: 11px 13px; font-size: 12px; font-weight: 650; color: #111827; border-bottom: 1px solid #f1f2f4; background: #ffffff; }
      .card .body { padding: 12px 13px; font-size: 12px; color: #374151; line-height: 1.65; }
      .code { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.55; margin: 0; }
      .tags { margin-top: 10px; }
      .tag { display: inline-block; margin: 0 6px 6px 0; padding: 4px 8px; border-radius: 999px; background: #f3f4f6; color: #4b5563; font-size: 11px; }
      .source { color: #2563eb; text-decoration: none; overflow-wrap: anywhere; word-break: break-all; }
      .skeleton { display: block; border-radius: 8px; background: linear-gradient(90deg, #eef0f3 0%, #f7f8fa 42%, #eef0f3 78%); background-size: 220% 100%; animation: shimmer 1.35s ease-in-out infinite; }
      .detail-skeleton .hero { padding: 18px; }
      .sk-title { width: 52%; height: 24px; }
      .sk-meta { width: 78%; height: 12px; margin-top: 12px; }
      .sk-line { height: 12px; margin-top: 12px; }
      .sk-line.short { width: 62%; }
      .sk-line.mid { width: 82%; }
      .sk-body { height: 220px; margin: 13px; }
      @keyframes shimmer { 0% { background-position: 120% 0; } 100% { background-position: -120% 0; } }
      @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main class="wrap${loading ? " detail-skeleton" : ""}"${loading ? ' aria-busy="true"' : ""}>
      ${loading ? `
      <section class="hero">
        <span class="skeleton sk-title"></span>
        <span class="skeleton sk-meta"></span>
        <span class="skeleton sk-line mid"></span>
        <span class="skeleton sk-line"></span>
        <span class="skeleton sk-line short"></span>
      </section>
      <section class="grid">
        <article class="card"><span class="skeleton sk-body"></span></article>
        <article class="card"><span class="skeleton sk-body"></span></article>
      </section>
      ` : `
      <section class="hero">
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">${escapeHtml(typeLabel)} · ${escapeHtml(spec)}${author ? ` · ${escapeHtml(author)}` : ""}</div>
        ${summary ? `<p class="summary">${escapeHtml(summary)}</p>` : ""}
        ${shouldShowDescription ? `<p class="summary">${escapeHtml(description as string)}</p>` : ""}
        ${tags && tags.length > 0 ? `<div class="tags">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        ${sourceUrl ? `<p class="meta" style="margin-top:12px;">${escapeHtml(sourceLabel ?? "Source")}: <a class="source" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceUrl)}</a></p>` : ""}
      </section>

      <section class="grid">
        <article class="card">
          <h2>Metadata</h2>
          <div class="body"><pre class="code">${escapeHtml(metadata)}</pre></div>
        </article>
        <article class="card">
          <h2>Content</h2>
          <div class="body"><pre class="code">${escapeHtml(content)}</pre></div>
        </article>
      </section>
      `}
    </main>
  </body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
