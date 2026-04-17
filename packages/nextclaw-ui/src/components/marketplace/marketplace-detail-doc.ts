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
      body { margin: 0; background: #f7f9fc; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .wrap { max-width: 980px; margin: 0 auto; padding: 28px 20px 40px; }
      .hero { border: 1px solid #dbeafe; border-radius: 16px; background: linear-gradient(180deg, #eff6ff, #ffffff); padding: 20px; box-shadow: 0 6px 20px rgba(30, 64, 175, 0.08); }
      .hero h1 { margin: 0; font-size: 26px; }
      .meta { margin-top: 8px; color: #475569; font-size: 13px; overflow-wrap: anywhere; word-break: break-word; }
      .summary { margin-top: 14px; font-size: 14px; line-height: 1.7; color: #334155; }
      .grid { display: grid; grid-template-columns: 260px 1fr; gap: 14px; margin-top: 16px; }
      .card { border: 1px solid #e2e8f0; background: #fff; border-radius: 14px; overflow: hidden; }
      .card h2 { margin: 0; padding: 12px 14px; font-size: 13px; font-weight: 700; color: #1d4ed8; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
      .card .body { padding: 12px 14px; font-size: 13px; color: #334155; line-height: 1.7; }
      .code { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.6; margin: 0; }
      .tags { margin-top: 10px; }
      .tag { display: inline-block; margin: 0 6px 6px 0; padding: 4px 9px; border-radius: 999px; background: #e0e7ff; color: #3730a3; font-size: 11px; }
      .source { color: #2563eb; text-decoration: none; overflow-wrap: anywhere; word-break: break-all; }
      @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main class="wrap">
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
    </main>
  </body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
