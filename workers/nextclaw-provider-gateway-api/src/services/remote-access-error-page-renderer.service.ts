function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveTitle(status: number): string {
  if (status === 404) {
    return "Remote session not found";
  }
  if (status === 410) {
    return "Remote session no longer available";
  }
  return "Remote access unavailable";
}

function resolveDescription(message: string, status: number): string {
  if (message === "Remote access session expired.") {
    return "This remote access session has expired. Open the device again from NextClaw to create a fresh browser session.";
  }
  if (message === "Remote access session revoked.") {
    return "This remote access session was revoked. Reopen the device from NextClaw if you still need access.";
  }
  if (message === "Remote share grant revoked.") {
    return "This shared remote link is no longer valid. Ask the owner to generate a new share link.";
  }
  if (status === 404) {
    return "This remote access session no longer exists. Open the device again from NextClaw to create a fresh browser session.";
  }
  return "Remote access is temporarily unavailable. Return to NextClaw and start a new remote session.";
}

export function renderRemoteAccessErrorPage(params: {
  status: number;
  message: string;
  webBaseUrl?: string | null;
}): Response {
  const { status, message, webBaseUrl } = params;
  const title = resolveTitle(status);
  const description = resolveDescription(message, status);
  const homeLink = webBaseUrl?.trim() ? webBaseUrl.trim().replace(/\/+$/, "") : null;
  const action = homeLink
    ? `<a class="primary" href="${escapeHtml(homeLink)}">Open NextClaw Web</a>`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f7fb;
        --card: rgba(255, 255, 255, 0.92);
        --border: rgba(15, 23, 42, 0.08);
        --text: #0f172a;
        --muted: #475569;
        --accent: #0f766e;
        --accent-hover: #115e59;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at top left, rgba(15, 118, 110, 0.10), transparent 32%),
          linear-gradient(180deg, #fbfcfe 0%, var(--bg) 100%);
        color: var(--text);
        font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .card {
        width: min(560px, 100%);
        padding: 32px;
        border-radius: 24px;
        background: var(--card);
        border: 1px solid var(--border);
        box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
      }
      .eyebrow {
        display: inline-flex;
        margin-bottom: 12px;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(15, 118, 110, 0.10);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0 0 12px;
        font-size: clamp(28px, 4vw, 38px);
        line-height: 1.12;
      }
      p {
        margin: 0;
        color: var(--muted);
      }
      .detail {
        margin-top: 16px;
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(148, 163, 184, 0.10);
        color: var(--text);
        font-size: 14px;
        word-break: break-word;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 24px;
      }
      .primary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 16px;
        border-radius: 12px;
        background: var(--accent);
        color: white;
        text-decoration: none;
        font-weight: 600;
      }
      .primary:hover {
        background: var(--accent-hover);
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="eyebrow">NextClaw Remote Access</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <div class="detail">${escapeHtml(params.message)}</div>
      <div class="actions">${action}</div>
    </main>
  </body>
</html>`;

  return new Response(html, {
    status: params.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
