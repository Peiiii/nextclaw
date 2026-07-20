(() => {
  const factories = globalThis.__NEXTCLAW_SKIN_STYLE_FACTORIES__;
  factories.push((context) => {
    const { config, dragonArt } = context;
    return `    html.nextclaw-skin-studio [data-skin-role="shell"] {
      background: var(--nextclaw-skin-bg) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar"] {
      position: relative;
      z-index: 4;
      background:
        radial-gradient(circle at 18% 12%, color-mix(in srgb, var(--nextclaw-skin-secondary) 18%, transparent), transparent 28%),
        radial-gradient(circle at 92% 76%, color-mix(in srgb, var(--nextclaw-skin-accent) 8%, transparent), transparent 24%),
        linear-gradient(180deg, color-mix(in srgb, var(--nextclaw-skin-panel) 98%, transparent), color-mix(in srgb, var(--nextclaw-skin-bg) 95%, transparent)) !important;
      border-right: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 28%, transparent) !important;
      box-shadow: 14px 0 36px color-mix(in srgb, var(--nextclaw-skin-bg) 34%, transparent) !important;
      backdrop-filter: blur(22px) saturate(125%);
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar"]::after {
      content: "${config.name.toUpperCase().replace(/["\\]/g, "")}";
      position: absolute;
      right: 17px;
      bottom: 59px;
      color: color-mix(in srgb, var(--nextclaw-skin-accent) 68%, transparent);
      font: 800 8px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: .15em;
      pointer-events: none;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar"] > div:first-child {
      border-bottom: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 14%, transparent);
      padding-block: 12px !important;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar"] img[alt="NextClaw"] {
      border-radius: 9px;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--nextclaw-skin-accent) 12%, transparent);
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar"] [class*="text-gray-"] {
      color: var(--nextclaw-skin-muted) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="nav-item"] {
      border: 1px solid transparent !important;
      border-radius: 13px !important;
      color: var(--nextclaw-skin-muted) !important;
      transition: color 160ms ease, background 160ms ease, border-color 160ms ease, transform 160ms ease !important;
    }
    html.nextclaw-skin-studio [data-skin-role="nav-item"]:hover {
      color: var(--nextclaw-skin-text) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-accent) 10%, transparent) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 15%, transparent) !important;
      transform: translateX(2px);
    }
    html.nextclaw-skin-studio [data-skin-role="nav-item"][data-skin-selected="true"],
    html.nextclaw-skin-studio [data-skin-role="sidebar"] [aria-current="page"] {
      color: color-mix(in srgb, var(--nextclaw-skin-text) 76%, var(--nextclaw-skin-accent)) !important;
      background: linear-gradient(90deg, color-mix(in srgb, var(--nextclaw-skin-accent) 27%, transparent), color-mix(in srgb, var(--nextclaw-skin-secondary) 13%, transparent)) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 30%, transparent) !important;
      box-shadow: inset 3px 0 var(--nextclaw-skin-accent), 0 7px 18px color-mix(in srgb, var(--nextclaw-skin-bg) 30%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="nav-item"][data-skin-selected="true"] *,
    html.nextclaw-skin-studio [data-skin-role="sidebar"] [aria-current="page"] * {
      color: inherit !important;
    }
    html.nextclaw-skin-studio [data-skin-role="session-item"] {
      position: relative;
      color: var(--nextclaw-skin-text) !important;
      background: transparent !important;
      border: 1px solid transparent !important;
      border-radius: 10px !important;
      box-shadow: none !important;
      transition: color 150ms ease, background 160ms ease !important;
    }
    html.nextclaw-skin-studio [data-skin-role="session-item"]::before {
      content: "";
      position: absolute;
      left: 4px;
      top: 28%;
      bottom: 28%;
      width: 3px;
      border-radius: 999px;
      background: linear-gradient(180deg, var(--nextclaw-skin-secondary), var(--nextclaw-skin-accent));
      opacity: 0;
      transform: scaleY(.3);
      transition: opacity 160ms ease, transform 180ms ease;
      pointer-events: none;
    }
    html.nextclaw-skin-studio [data-skin-role="session-item"]:hover {
      background: linear-gradient(95deg, color-mix(in srgb, var(--nextclaw-skin-accent) 10%, transparent), color-mix(in srgb, var(--nextclaw-skin-secondary) 4%, transparent)) !important;
      border-color: transparent !important;
    }
    html.nextclaw-skin-studio [data-skin-role="session-item"]:hover::before,
    html.nextclaw-skin-studio [data-skin-role="session-item"][data-skin-selected="true"]::before {
      opacity: 1;
      transform: scaleY(1);
    }
    html.nextclaw-skin-studio [data-skin-role="session-item"][data-skin-selected="true"] {
      color: var(--nextclaw-skin-text) !important;
      background: linear-gradient(95deg, color-mix(in srgb, var(--nextclaw-skin-accent) 15%, transparent), color-mix(in srgb, var(--nextclaw-skin-secondary) 7%, transparent)) !important;
      border-color: transparent !important;
      box-shadow: none !important;
    }
    html.nextclaw-skin-studio [data-skin-role="session-content"] {
      color: inherit !important;
      background: transparent !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      transform: none !important;
    }
    html.nextclaw-skin-studio [data-skin-role="session-content"] > div:last-child {
      color: var(--nextclaw-skin-muted) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="session-item"][data-skin-selected="true"] [data-skin-role="session-content"] > div:first-child {
      color: color-mix(in srgb, var(--nextclaw-skin-text) 74%, var(--nextclaw-skin-accent)) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="icon-button"] {
      color: var(--nextclaw-skin-muted) !important;
      border: 1px solid transparent !important;
      border-radius: 9px !important;
    }
    html.nextclaw-skin-studio [data-skin-role="icon-button"]:hover {
      color: var(--nextclaw-skin-accent) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-accent) 11%, transparent) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 16%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="run-indicator"] {
      position: relative;
      width: 30px !important;
      height: 30px !important;
      overflow: visible !important;
      color: var(--nextclaw-skin-accent) !important;
      filter: none !important;
    }
    html.nextclaw-skin-studio [data-skin-role="run-indicator"] > svg {
      display: none !important;
    }
    html.nextclaw-skin-studio [data-skin-role="run-indicator"]::before {
      content: "";
      position: absolute;
      inset: -2px;
      background: ${dragonArt} center / contain no-repeat;
      animation: nextclaw-skin-dragon-swim 2.35s linear infinite;
      transform-origin: center;
    }
    html.nextclaw-skin-studio [data-skin-role="run-indicator"]::after {
      content: none;
    }
`;
  });
})();
