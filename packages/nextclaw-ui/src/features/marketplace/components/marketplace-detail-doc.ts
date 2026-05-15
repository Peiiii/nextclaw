import {
  escapeHtml,
  renderDetailMarkdown,
  renderDetailMetadata,
} from "@/features/marketplace/components/detail-doc/marketplace-detail-doc-renderer";

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
  const renderedMetadata = renderDetailMetadata(metadata);
  const renderedContent = renderDetailMarkdown(content);

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; background: #f9f8f5; color: #2f2212; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .wrap { max-width: 940px; margin: 0 auto; padding: 24px 20px 36px; }
      .hero { border: 1px solid #f0e2c8; border-radius: 14px; background: linear-gradient(180deg, #fff9f1 0%, #ffffff 28%); padding: 18px; box-shadow: 0 1px 3px rgba(30, 20, 10, 0.05); }
      .hero h1 { margin: 0; font-size: 22px; line-height: 1.2; letter-spacing: 0; }
      .meta { margin-top: 7px; color: #78644d; font-size: 12px; overflow-wrap: anywhere; word-break: break-word; }
      .summary { margin: 12px 0 0; font-size: 13px; line-height: 1.65; color: #5f5142; }
      .grid { display: grid; grid-template-columns: minmax(220px, 0.42fr) minmax(0, 1fr); gap: 12px; margin-top: 12px; }
      .card { border: 1px solid #eee3d1; background: #fffdf9; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(30, 20, 10, 0.035); }
      .card h2 { margin: 0; padding: 11px 13px; font-size: 12px; font-weight: 650; color: #3f472f; border-bottom: 1px solid #f1e7d4; background: #fffaf2; }
      .card .body { padding: 12px 13px; font-size: 12px; color: #4e463d; line-height: 1.65; }
      .code { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.55; margin: 0; }
      .metadata-list { margin: 0; }
      .metadata-list div { display: grid; grid-template-columns: minmax(72px, 0.36fr) minmax(0, 1fr); gap: 10px; padding: 8px 0; border-bottom: 1px solid #f2eadc; }
      .metadata-list div:last-child { border-bottom: 0; }
      .metadata-list dt { color: #7a5a24; font-weight: 650; overflow-wrap: anywhere; }
      .metadata-list dd { margin: 0; color: #4e463d; overflow-wrap: anywhere; }
      .markdown { font-size: 13px; line-height: 1.68; }
      .markdown > *:first-child { margin-top: 0; }
      .markdown > *:last-child { margin-bottom: 0; }
      .markdown h1, .markdown h2, .markdown h3, .markdown h4 { margin: 18px 0 8px; color: #2f2212; line-height: 1.25; letter-spacing: 0; }
      .markdown h1 { font-size: 20px; }
      .markdown h2 { font-size: 17px; }
      .markdown h3 { font-size: 15px; }
      .markdown h4 { font-size: 13px; }
      .markdown p { margin: 10px 0; }
      .markdown ul, .markdown ol { margin: 10px 0; padding-left: 20px; }
      .markdown li { margin: 5px 0; }
      .markdown blockquote { margin: 12px 0; padding: 8px 12px; border-left: 3px solid #d9b56f; border-radius: 8px; background: #fff7ea; color: #6d5841; }
      .markdown code { border: 1px solid #eadcc6; border-radius: 5px; background: #fff7ea; padding: 1px 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; color: #6b4b16; }
      .markdown a { color: #5f6b45; text-decoration: none; font-weight: 600; }
      .markdown a:hover { text-decoration: underline; }
      .code-block { position: relative; margin: 12px 0; overflow: hidden; border: 1px solid #eadcc6; border-radius: 10px; background: #2f2a24; }
      .code-block pre { margin: 0; overflow-x: auto; padding: 13px; }
      .code-block code { border: 0; border-radius: 0; background: transparent; padding: 0; color: #f7efe3; }
      .code-language { position: absolute; right: 10px; top: 8px; color: #d8c3a0; font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .tags { margin-top: 10px; }
      .tag { display: inline-block; margin: 0 6px 6px 0; padding: 4px 8px; border: 1px solid #ecd9b5; border-radius: 999px; background: #fff7ea; color: #7a5a24; font-size: 11px; }
      .source { color: #5f6b45; text-decoration: none; overflow-wrap: anywhere; word-break: break-all; }
      .source:hover { text-decoration: underline; }
      .skeleton { display: block; border-radius: 8px; background: linear-gradient(90deg, #f0e6d6 0%, #fffaf2 42%, #f0e6d6 78%); background-size: 220% 100%; animation: shimmer 1.35s ease-in-out infinite; }
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
          <div class="body">${renderedMetadata}</div>
        </article>
        <article class="card">
          <h2>Content</h2>
          <div class="body markdown">${renderedContent}</div>
        </article>
      </section>
      `}
    </main>
  </body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
