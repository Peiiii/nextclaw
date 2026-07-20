(() => {
  const factories = globalThis.__NEXTCLAW_SKIN_STYLE_FACTORIES__;
  factories.push((context) => {
    const {
      config,
      isConcept,
      signature,
      skinLabel,
      tagline,
    } = context;
    if (!isConcept) return "";
    return `
    html.nextclaw-skin-studio [data-skin-role="sidebar"] {
      background:
        linear-gradient(90deg, transparent 0 96%, color-mix(in srgb, var(--nextclaw-skin-accent) 14%, transparent) 96% 96.5%, transparent 96.5%),
        radial-gradient(circle at 14% 11%, color-mix(in srgb, var(--nextclaw-skin-secondary) 19%, transparent), transparent 27%),
        linear-gradient(180deg, color-mix(in srgb, var(--nextclaw-skin-panel) 97%, transparent), color-mix(in srgb, var(--nextclaw-skin-bg) 92%, transparent)) !important;
      box-shadow: 10px 0 30px color-mix(in srgb, var(--nextclaw-skin-accent) 8%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar"]::before {
      content: "✦";
      position: absolute;
      z-index: 0;
      right: 13px;
      top: 25.5%;
      color: color-mix(in srgb, var(--nextclaw-skin-secondary) 70%, transparent);
      font: 18px/1 Georgia, serif;
      pointer-events: none;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar"]::after {
      content: "${skinLabel}  ·  NEXTCLAW";
      right: 20px;
      bottom: 64px;
      color: color-mix(in srgb, var(--nextclaw-skin-accent) 62%, transparent);
      font-weight: 700;
      letter-spacing: .16em;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-brand"] {
      position: relative;
      min-height: 62px;
      padding: 16px 20px 11px !important;
      border-bottom: 0 !important;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-brand"]::after {
      content: "${signature || config.name}";
      position: absolute;
      left: 57px;
      bottom: 6px;
      color: color-mix(in srgb, var(--nextclaw-skin-accent) 72%, transparent);
      font: 500 9px/1 "Snell Roundhand", "Segoe Script", cursive;
      letter-spacing: .06em;
      pointer-events: none;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-brand"] img[alt="NextClaw"] {
      border-radius: 50%;
      filter: sepia(.16) saturate(.72);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--nextclaw-skin-secondary) 20%, transparent), 0 7px 18px color-mix(in srgb, var(--nextclaw-skin-accent) 15%, transparent);
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-new-task"] {
      padding: 7px 14px 9px !important;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-new-task"] > * {
      border: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 16%, transparent) !important;
      border-radius: 999px !important;
      background: linear-gradient(100deg, color-mix(in srgb, var(--nextclaw-skin-secondary) 18%, var(--nextclaw-skin-panel)), color-mix(in srgb, var(--nextclaw-skin-panel) 88%, transparent)) !important;
      box-shadow: inset 0 1px color-mix(in srgb, white 62%, transparent), 0 7px 22px color-mix(in srgb, var(--nextclaw-skin-accent) 8%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-search"] {
      padding: 0 16px 11px !important;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-search"] input {
      height: 40px !important;
      padding-left: 42px !important;
      border: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 24%, transparent) !important;
      border-radius: 999px !important;
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 75%, transparent) !important;
      box-shadow: inset 0 1px 8px color-mix(in srgb, var(--nextclaw-skin-secondary) 9%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-primary-nav"] {
      position: relative;
      padding: 8px 16px 12px !important;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-primary-nav"]::after {
      content: "✦";
      position: absolute;
      right: 26px;
      bottom: 2px;
      color: color-mix(in srgb, var(--nextclaw-skin-secondary) 74%, transparent);
      font-size: 13px;
      pointer-events: none;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-primary-nav"] [data-skin-role="nav-item"] {
      min-height: 38px;
      padding-inline: 11px !important;
      border-radius: 11px !important;
      font-weight: 560 !important;
      letter-spacing: .015em;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-primary-nav"] [data-skin-role="nav-item"] svg {
      color: color-mix(in srgb, var(--nextclaw-skin-accent) 76%, var(--nextclaw-skin-muted)) !important;
      filter: drop-shadow(0 2px 5px color-mix(in srgb, var(--nextclaw-skin-accent) 12%, transparent));
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-divider"] {
      height: 1px !important;
      margin: 0 20px !important;
      border: 0 !important;
      background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--nextclaw-skin-accent) 25%, transparent) 0 4px, transparent 4px 9px) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-session-heading"] {
      min-height: 47px;
      padding: 15px 22px 8px !important;
      color: var(--nextclaw-skin-muted) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-session-heading"]::before {
      content: "♡";
      margin-right: 6px;
      color: color-mix(in srgb, var(--nextclaw-skin-accent) 66%, transparent);
      font-family: Georgia, serif;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-session-heading"] [data-skin-role="nav-item"] {
      padding: 3px 7px !important;
      border-radius: 999px !important;
      font-size: 11px !important;
      letter-spacing: .04em;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-session-scroll"] {
      padding: 0 13px 46px !important;
      overflow-x: hidden !important;
      mask-image: linear-gradient(to bottom, transparent 0, black 15px, black calc(100% - 40px), transparent 100%) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="session-group"] {
      position: relative;
      min-width: 0;
      margin-bottom: 17px;
    }
    html.nextclaw-skin-studio [data-skin-role="session-group-label"] {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 6px 8px 7px !important;
      color: color-mix(in srgb, var(--nextclaw-skin-muted) 74%, var(--nextclaw-skin-accent)) !important;
      font: 650 9px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace !important;
      letter-spacing: .14em !important;
    }
    html.nextclaw-skin-studio [data-skin-role="session-group-label"]::before { content: "✦"; font-size: 9px; }
    html.nextclaw-skin-studio [data-skin-role="session-group-label"]::after {
      content: "";
      height: 1px;
      flex: 1;
      background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--nextclaw-skin-accent) 20%, transparent) 0 3px, transparent 3px 8px);
    }
    html.nextclaw-skin-studio [data-skin-role="session-group-list"] {
      display: grid;
      min-width: 0;
      grid-template-columns: minmax(0, 1fr);
      gap: 1px;
    }
    html.nextclaw-skin-studio [data-skin-role="session-item"] {
      width: 100%;
      min-width: 0;
      min-height: 55px;
      padding: 8px 8px 8px 31px !important;
      border: 0 !important;
      border-radius: 9px !important;
      background: transparent !important;
    }
    html.nextclaw-skin-studio [data-skin-role="session-item"]::before {
      content: "○";
      left: 9px;
      top: 13px;
      bottom: auto;
      width: auto;
      color: color-mix(in srgb, var(--nextclaw-skin-accent) 58%, var(--nextclaw-skin-muted));
      background: none;
      font: 15px/1 Georgia, serif;
      opacity: .74;
      transform: none;
    }
    html.nextclaw-skin-studio [data-skin-role="session-item"]:nth-child(3n + 2)::before { content: "✧"; }
    html.nextclaw-skin-studio [data-skin-role="session-item"]:nth-child(3n)::before { content: "♡"; font-size: 12px; }
    html.nextclaw-skin-studio [data-skin-role="session-item"]:hover {
      background: linear-gradient(90deg, color-mix(in srgb, var(--nextclaw-skin-secondary) 12%, transparent), transparent) !important;
      box-shadow: none !important;
      transform: translateX(2px);
    }
    html.nextclaw-skin-studio [data-skin-role="session-item"][data-skin-selected="true"] {
      background: linear-gradient(90deg, color-mix(in srgb, var(--nextclaw-skin-accent) 16%, transparent), color-mix(in srgb, var(--nextclaw-skin-secondary) 5%, transparent)) !important;
      box-shadow: inset 2px 0 color-mix(in srgb, var(--nextclaw-skin-accent) 72%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="session-item"][data-skin-selected="true"]::before {
      content: "✦";
      color: var(--nextclaw-skin-accent);
      opacity: 1;
    }
    html.nextclaw-skin-studio [data-skin-role="session-content"] > div:first-child {
      min-height: 20px;
      font-family: "Songti SC", STSong, Georgia, serif;
      letter-spacing: .012em;
    }
    html.nextclaw-skin-studio [data-skin-role="session-content"] { min-width: 0; }
    html.nextclaw-skin-studio [data-skin-role="session-content"] > div:last-child {
      margin-top: 2px !important;
      color: color-mix(in srgb, var(--nextclaw-skin-muted) 82%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-footer"] {
      position: relative;
      margin: 0 13px 10px;
      padding: 12px 12px 29px !important;
      border: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 18%, transparent);
      border-radius: 16px;
      background: linear-gradient(100deg, color-mix(in srgb, var(--nextclaw-skin-panel) 88%, transparent), color-mix(in srgb, var(--nextclaw-skin-secondary) 11%, transparent));
      box-shadow: 0 9px 28px color-mix(in srgb, var(--nextclaw-skin-accent) 8%, transparent);
    }
    html.nextclaw-skin-studio [data-skin-role="sidebar-footer"]::after {
      content: "${tagline}";
      position: absolute;
      left: 15px;
      right: 15px;
      bottom: 10px;
      overflow: hidden;
      color: color-mix(in srgb, var(--nextclaw-skin-accent) 60%, transparent);
      font: 650 7px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: .08em;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
`;
  });
})();
