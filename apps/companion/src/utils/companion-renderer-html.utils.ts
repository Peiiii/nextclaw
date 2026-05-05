const COMPANION_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>NextClaw Companion</title>
    <style>
      :root {
        color-scheme: light;
        --ring: rgba(12, 84, 190, 0.2);
        --panel: rgba(255, 255, 255, 0.88);
        --ink: #16324f;
        --muted: #5f6c7c;
        --idle: #d7dce2;
        --running: #26a269;
        --offline: #d64545;
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: transparent;
        font-family: "SF Pro Display", "Helvetica Neue", sans-serif;
      }
      body {
        display: grid;
        place-items: center;
      }
      button {
        border: 0;
        background: none;
        padding: 0;
        cursor: pointer;
      }
      .shell {
        width: 112px;
        height: 132px;
        display: grid;
        justify-items: center;
        gap: 8px;
      }
      .avatar {
        width: 96px;
        height: 96px;
        border-radius: 28px;
        background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(235,241,247,0.94));
        box-shadow: 0 14px 36px rgba(13, 30, 51, 0.16), inset 0 0 0 1px rgba(255,255,255,0.82);
        position: relative;
        display: grid;
        place-items: center;
        overflow: hidden;
        -webkit-app-region: drag;
      }
      .avatar::after {
        content: "";
        position: absolute;
        inset: 4px;
        border-radius: 24px;
        box-shadow: inset 0 0 0 1px var(--ring);
        pointer-events: none;
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .initials {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        color: var(--ink);
        font-size: 28px;
        font-weight: 700;
        letter-spacing: 0;
        background: radial-gradient(circle at top, rgba(255,255,255,0.98), rgba(223,232,242,0.96));
      }
      .status {
        position: absolute;
        right: 8px;
        bottom: 8px;
        width: 14px;
        height: 14px;
        border-radius: 999px;
        border: 2px solid var(--panel);
        background: var(--idle);
      }
      .status[data-state="running"] { background: var(--running); }
      .status[data-state="offline"] { background: var(--offline); }
      .meta {
        width: 100%;
        padding: 0 4px;
        text-align: center;
        -webkit-app-region: no-drag;
        cursor: pointer;
      }
      .title {
        color: var(--ink);
        font-size: 12px;
        font-weight: 700;
        line-height: 1.25;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .subtitle {
        color: var(--muted);
        font-size: 11px;
        line-height: 1.2;
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .actions {
        position: absolute;
        top: 6px;
        right: 6px;
        display: flex;
        gap: 4px;
        -webkit-app-region: no-drag;
      }
      .icon-button {
        width: 18px;
        height: 18px;
        border-radius: 999px;
        background: rgba(22, 50, 79, 0.12);
        color: var(--ink);
        font-size: 11px;
        font-weight: 700;
        display: grid;
        place-items: center;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="avatar">
        <div class="actions">
          <button class="icon-button" id="close-button" type="button" aria-label="Quit Companion">x</button>
        </div>
        <div class="initials" id="initials">NC</div>
        <img id="avatar-image" alt="" hidden />
        <span class="status" id="status-dot" data-state="idle"></span>
      </div>
      <div class="meta" id="open-button" role="button" tabindex="0" aria-label="Open NextClaw">
        <div class="title" id="title">NextClaw</div>
        <div class="subtitle" id="subtitle">Waiting</div>
      </div>
    </div>
    <script>
      const titleNode = document.getElementById("title");
      const subtitleNode = document.getElementById("subtitle");
      const initialsNode = document.getElementById("initials");
      const avatarImageNode = document.getElementById("avatar-image");
      const statusNode = document.getElementById("status-dot");
      const openButtonNode = document.getElementById("open-button");
      const closeButtonNode = document.getElementById("close-button");
      const applyView = (view) => {
        titleNode.textContent = view.title;
        subtitleNode.textContent = view.subtitle;
        initialsNode.textContent = (view.title || "NC").slice(0, 2).toUpperCase();
        statusNode.dataset.state = view.state;
        if (view.avatarUrl) {
          avatarImageNode.src = view.avatarUrl;
          avatarImageNode.hidden = false;
          initialsNode.hidden = true;
        } else {
          avatarImageNode.hidden = true;
          avatarImageNode.removeAttribute("src");
          initialsNode.hidden = false;
        }
      };
      window.nextclawCompanion.onView(applyView);
      openButtonNode.addEventListener("click", () => window.nextclawCompanion.open());
      openButtonNode.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          window.nextclawCompanion.open();
        }
      });
      closeButtonNode.addEventListener("click", () => window.nextclawCompanion.quit());
      window.nextclawCompanion.ready();
    </script>
  </body>
</html>`;

export function renderCompanionHtml(): string {
  return COMPANION_HTML;
}
