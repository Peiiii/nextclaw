(() => {
  const factories = globalThis.__NEXTCLAW_SKIN_STYLE_FACTORIES__;
  factories.push(() => {
    return `    html.nextclaw-skin-studio [data-skin-role="page"] {
      position: relative;
      isolation: isolate;
      color: var(--nextclaw-skin-text) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="page"] [class*="text-gray-9"] {
      color: var(--nextclaw-skin-text) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="page"] [class*="text-gray-4"],
    html.nextclaw-skin-studio [data-skin-role="page"] [class*="text-gray-5"],
    html.nextclaw-skin-studio [data-skin-role="page"] [class*="text-gray-6"] {
      color: var(--nextclaw-skin-muted) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="page"] > * {
      position: relative;
      z-index: 1;
    }
    html.nextclaw-skin-studio [data-skin-role="button"] {
      transition: color 150ms ease, background 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease !important;
    }
    html.nextclaw-skin-studio [data-skin-role="button"]:hover {
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 22%, var(--nextclaw-skin-border)) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="button"]:active {
      transform: translateY(1px);
    }
    html.nextclaw-skin-studio [data-skin-role="button"]:focus-visible,
    html.nextclaw-skin-studio [data-skin-role="link"]:focus-visible,
    html.nextclaw-skin-studio [data-skin-role="choice"]:focus-visible,
    html.nextclaw-skin-studio [data-skin-role="select"]:focus-visible {
      outline: none !important;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--nextclaw-skin-accent) 17%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="button"]:disabled,
    html.nextclaw-skin-studio [data-skin-role="primary-action"]:disabled,
    html.nextclaw-skin-studio [data-skin-role="input"]:disabled,
    html.nextclaw-skin-studio [aria-disabled="true"] {
      cursor: not-allowed !important;
      opacity: .44 !important;
      filter: saturate(.55);
    }
    html.nextclaw-skin-studio [data-skin-role="link"] {
      color: color-mix(in srgb, var(--nextclaw-skin-accent) 84%, var(--nextclaw-skin-text)) !important;
      text-decoration-color: color-mix(in srgb, var(--nextclaw-skin-accent) 32%, transparent) !important;
      text-underline-offset: 3px;
    }
    html.nextclaw-skin-studio [data-skin-role="link"]:hover {
      color: var(--nextclaw-skin-accent) !important;
      text-decoration-color: currentColor !important;
    }
    html.nextclaw-skin-studio [data-skin-role="primary-action"] {
      color: var(--nextclaw-skin-bg) !important;
      background: linear-gradient(135deg, var(--nextclaw-skin-accent), var(--nextclaw-skin-secondary)) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 62%, white) !important;
      border-radius: 999px !important;
      box-shadow: 0 9px 22px color-mix(in srgb, var(--nextclaw-skin-accent) 22%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="primary-action"]:hover {
      filter: brightness(1.035) saturate(1.04);
      box-shadow: 0 12px 28px color-mix(in srgb, var(--nextclaw-skin-accent) 29%, transparent) !important;
      transform: translateY(-1px);
    }
    html.nextclaw-skin-studio [data-skin-role="separator"] {
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 13%, var(--nextclaw-skin-border)) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-accent) 13%, var(--nextclaw-skin-border)) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="settings-section"] {
      padding: 18px 20px;
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 92%, transparent) !important;
      border: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 15%, var(--nextclaw-skin-border)) !important;
      border-radius: 19px !important;
      box-shadow: 0 14px 38px color-mix(in srgb, var(--nextclaw-skin-bg) 23%, transparent), inset 0 1px color-mix(in srgb, white 40%, transparent) !important;
      backdrop-filter: blur(17px) saturate(116%);
    }
    html.nextclaw-skin-studio [data-skin-role="collection-section"] {
      padding: 16px 18px;
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 76%, transparent) !important;
      border: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 11%, transparent) !important;
      border-radius: 19px !important;
      box-shadow: 0 10px 30px color-mix(in srgb, var(--nextclaw-skin-bg) 17%, transparent) !important;
      backdrop-filter: blur(14px) saturate(112%);
    }
    html.nextclaw-skin-studio [data-skin-role="collection-section"] > div:first-child h2,
    html.nextclaw-skin-studio [data-skin-role="collection-section"] > h2 {
      color: color-mix(in srgb, var(--nextclaw-skin-text) 80%, var(--nextclaw-skin-accent)) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="badge"] {
      color: color-mix(in srgb, var(--nextclaw-skin-text) 68%, var(--nextclaw-skin-accent)) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-accent) 10%, var(--nextclaw-skin-panel)) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 22%, transparent) !important;
      box-shadow: inset 0 1px color-mix(in srgb, white 38%, transparent);
    }
    html.nextclaw-skin-studio [data-skin-role="keycap"] {
      color: var(--nextclaw-skin-muted) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-bg) 72%, var(--nextclaw-skin-panel)) !important;
      border: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 18%, var(--nextclaw-skin-border)) !important;
      border-bottom-width: 2px !important;
      border-radius: 7px !important;
      box-shadow: 0 2px 0 color-mix(in srgb, var(--nextclaw-skin-border) 72%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="skeleton"] {
      background: linear-gradient(100deg, color-mix(in srgb, var(--nextclaw-skin-panel) 82%, var(--nextclaw-skin-bg)) 20%, color-mix(in srgb, var(--nextclaw-skin-accent) 10%, var(--nextclaw-skin-panel)) 44%, color-mix(in srgb, var(--nextclaw-skin-panel) 82%, var(--nextclaw-skin-bg)) 68%) !important;
      background-size: 220% 100% !important;
      animation: nextclaw-skin-shimmer 1.7s ease-in-out infinite !important;
    }
    html.nextclaw-skin-studio [data-skin-role="card"] {
      color: var(--nextclaw-skin-text) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 95%, transparent) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-border) 78%, transparent) !important;
      border-radius: 17px !important;
      box-shadow: 0 10px 28px color-mix(in srgb, var(--nextclaw-skin-bg) 33%, transparent), inset 0 1px color-mix(in srgb, white 42%, transparent) !important;
      backdrop-filter: blur(16px) saturate(112%);
      transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease !important;
    }
    html.nextclaw-skin-studio [data-skin-role="card"]:hover {
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 98%, var(--nextclaw-skin-accent)) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 38%, transparent) !important;
      box-shadow: 0 16px 38px color-mix(in srgb, var(--nextclaw-skin-bg) 40%, transparent), inset 0 1px color-mix(in srgb, white 52%, transparent) !important;
      transform: translateY(-2px);
    }
    html.nextclaw-skin-studio [data-skin-role="card"] p,
    html.nextclaw-skin-studio [data-skin-role="card"] [class*="text-gray-4"],
    html.nextclaw-skin-studio [data-skin-role="card"] [class*="text-gray-5"] {
      color: var(--nextclaw-skin-muted) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="card"] [class*="font-semibold"] {
      color: var(--nextclaw-skin-text) !important;
    }
    html.nextclaw-skin-studio[data-nextclaw-skin-page="chat-session"] [data-skin-role="card"] {
      padding: 16px 18px;
      background:
        linear-gradient(145deg, color-mix(in srgb, var(--nextclaw-skin-panel) 92%, transparent), color-mix(in srgb, var(--nextclaw-skin-bg) 87%, transparent)) !important;
      border: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 14%, var(--nextclaw-skin-border)) !important;
      border-radius: 18px !important;
      box-shadow: 0 12px 34px color-mix(in srgb, var(--nextclaw-skin-bg) 24%, transparent), inset 0 1px color-mix(in srgb, white 34%, transparent) !important;
    }
    html.nextclaw-skin-studio[data-nextclaw-skin-page="chat-session"] [data-skin-role="card"]:hover {
      background:
        linear-gradient(145deg, color-mix(in srgb, var(--nextclaw-skin-panel) 92%, transparent), color-mix(in srgb, var(--nextclaw-skin-bg) 87%, transparent)) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 14%, var(--nextclaw-skin-border)) !important;
      box-shadow: 0 12px 34px color-mix(in srgb, var(--nextclaw-skin-bg) 24%, transparent), inset 0 1px color-mix(in srgb, white 34%, transparent) !important;
      transform: none;
    }
    html.nextclaw-skin-studio[data-nextclaw-skin-page="chat-session"] [data-skin-role="card"] p,
    html.nextclaw-skin-studio[data-nextclaw-skin-page="chat-session"] [data-skin-role="card"] li,
    html.nextclaw-skin-studio[data-nextclaw-skin-page="chat-session"] [data-skin-role="card"] h1,
    html.nextclaw-skin-studio[data-nextclaw-skin-page="chat-session"] [data-skin-role="card"] h2,
    html.nextclaw-skin-studio[data-nextclaw-skin-page="chat-session"] [data-skin-role="card"] h3 {
      color: var(--nextclaw-skin-text) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="user-message"] {
      color: var(--nextclaw-skin-bg) !important;
      background: linear-gradient(135deg, var(--nextclaw-skin-accent), var(--nextclaw-skin-secondary)) !important;
      border: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 70%, white) !important;
      border-radius: 19px 19px 6px 19px !important;
      box-shadow: 0 10px 26px color-mix(in srgb, var(--nextclaw-skin-accent) 22%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="user-message"] * {
      color: inherit !important;
    }
    html.nextclaw-skin-studio [data-skin-role="assistant-avatar"] {
      color: var(--nextclaw-skin-bg) !important;
      background: linear-gradient(145deg, var(--nextclaw-skin-accent), var(--nextclaw-skin-secondary)) !important;
      border: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 62%, white) !important;
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--nextclaw-skin-accent) 11%, transparent), 0 8px 20px color-mix(in srgb, var(--nextclaw-skin-accent) 21%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="process-row"] {
      color: var(--nextclaw-skin-muted) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-bg) 52%, transparent) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 13%, var(--nextclaw-skin-border)) !important;
      border-radius: 11px !important;
    }
    html.nextclaw-skin-studio [data-skin-role="code-block"] {
      color: color-mix(in srgb, var(--nextclaw-skin-text) 94%, var(--nextclaw-skin-accent)) !important;
      background:
        radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--nextclaw-skin-accent) 7%, transparent), transparent 36%),
        color-mix(in srgb, var(--nextclaw-skin-bg) 92%, black) !important;
      border: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 20%, var(--nextclaw-skin-border)) !important;
      border-radius: 13px !important;
      box-shadow: inset 3px 0 var(--nextclaw-skin-accent), 0 10px 26px color-mix(in srgb, var(--nextclaw-skin-bg) 24%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="code-block"] code {
      color: inherit !important;
    }
    html.nextclaw-skin-studio article code:not(pre code) {
      color: color-mix(in srgb, var(--nextclaw-skin-text) 74%, var(--nextclaw-skin-accent)) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-accent) 9%, var(--nextclaw-skin-panel)) !important;
      border: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 14%, transparent) !important;
      border-radius: 7px !important;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }
    html.nextclaw-skin-studio [data-skin-role="composer"] > div {
      background:
        linear-gradient(150deg, color-mix(in srgb, var(--nextclaw-skin-panel) 95%, transparent), color-mix(in srgb, var(--nextclaw-skin-bg) 88%, transparent)) !important;
      border: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 25%, var(--nextclaw-skin-border)) !important;
      box-shadow: 0 18px 52px color-mix(in srgb, var(--nextclaw-skin-bg) 34%, transparent), inset 0 1px color-mix(in srgb, white 40%, transparent) !important;
      backdrop-filter: blur(22px) saturate(126%);
    }
    html.nextclaw-skin-studio [data-skin-role="composer"]:focus-within > div {
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 58%, var(--nextclaw-skin-border)) !important;
      box-shadow: 0 20px 58px color-mix(in srgb, var(--nextclaw-skin-bg) 38%, transparent), 0 0 0 3px color-mix(in srgb, var(--nextclaw-skin-accent) 10%, transparent) !important;
    }
`;
  });
})();
