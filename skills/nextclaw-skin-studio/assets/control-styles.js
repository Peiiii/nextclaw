(() => {
  const factories = globalThis.__NEXTCLAW_SKIN_STYLE_FACTORIES__;
  factories.push((context) => {
    const { config, signature } = context;
    return `    html.nextclaw-skin-studio [data-skin-role="chat-header"] {
      position: relative;
      box-shadow: 0 8px 28px color-mix(in srgb, var(--nextclaw-skin-bg) 20%, transparent);
    }
    html.nextclaw-skin-studio[data-nextclaw-skin-page="chat-session"] [data-skin-role="chat-header"]::after {
      content: "${signature || config.details?.label || config.name}";
      position: absolute;
      right: 90px;
      bottom: 10px;
      color: color-mix(in srgb, var(--nextclaw-skin-accent) 66%, transparent);
      font: 500 14px/1 "Snell Roundhand", "Segoe Script", "Bradley Hand", cursive;
      letter-spacing: .03em;
      pointer-events: none;
    }
    html.nextclaw-skin-studio [data-skin-role="card-icon"] {
      color: var(--nextclaw-skin-bg) !important;
      background: linear-gradient(145deg, var(--nextclaw-skin-accent), var(--nextclaw-skin-secondary)) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 56%, transparent) !important;
      box-shadow: 0 7px 18px color-mix(in srgb, var(--nextclaw-skin-accent) 24%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="card-action"] {
      color: var(--nextclaw-skin-accent) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 88%, transparent) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 28%, transparent) !important;
      border-radius: 10px !important;
    }
    html.nextclaw-skin-studio [data-skin-role="card-action"]:hover {
      color: var(--nextclaw-skin-bg) !important;
      background: var(--nextclaw-skin-accent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="input"] {
      color: var(--nextclaw-skin-text) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 92%, transparent) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-border) 76%, transparent) !important;
      box-shadow: inset 0 1px color-mix(in srgb, white 38%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="input"]:focus {
      border-color: var(--nextclaw-skin-accent) !important;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--nextclaw-skin-accent) 14%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="input"]::placeholder {
      color: color-mix(in srgb, var(--nextclaw-skin-muted) 72%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="select"] {
      color: var(--nextclaw-skin-text) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 94%, transparent) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 16%, var(--nextclaw-skin-border)) !important;
      border-radius: 12px !important;
      box-shadow: inset 0 1px color-mix(in srgb, white 35%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="select"]:hover,
    html.nextclaw-skin-studio [data-skin-role="select"][data-state="open"] {
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 48%, var(--nextclaw-skin-border)) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 96%, var(--nextclaw-skin-accent)) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="switch"] {
      background: color-mix(in srgb, var(--nextclaw-skin-muted) 22%, var(--nextclaw-skin-panel)) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-muted) 32%, var(--nextclaw-skin-border)) !important;
      box-shadow: inset 0 1px 3px color-mix(in srgb, var(--nextclaw-skin-bg) 28%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="switch"][data-skin-selected="true"] {
      background: linear-gradient(90deg, var(--nextclaw-skin-accent), var(--nextclaw-skin-secondary)) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 62%, white) !important;
      box-shadow: 0 5px 14px color-mix(in srgb, var(--nextclaw-skin-accent) 20%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="switch"] > span {
      background: color-mix(in srgb, white 96%, var(--nextclaw-skin-panel)) !important;
      box-shadow: 0 2px 7px color-mix(in srgb, var(--nextclaw-skin-bg) 36%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="choice"] {
      color: var(--nextclaw-skin-muted) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 58%, transparent) !important;
      border: 1px solid color-mix(in srgb, var(--nextclaw-skin-border) 64%, transparent) !important;
      border-radius: 13px !important;
    }
    html.nextclaw-skin-studio [data-skin-role="choice"]:hover {
      color: var(--nextclaw-skin-text) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 27%, var(--nextclaw-skin-border)) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-accent) 7%, var(--nextclaw-skin-panel)) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="choice"][data-skin-selected="true"] {
      color: var(--nextclaw-skin-text) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 42%, var(--nextclaw-skin-border)) !important;
      background: linear-gradient(135deg, color-mix(in srgb, var(--nextclaw-skin-accent) 13%, var(--nextclaw-skin-panel)), color-mix(in srgb, var(--nextclaw-skin-secondary) 8%, var(--nextclaw-skin-panel))) !important;
      box-shadow: inset 3px 0 var(--nextclaw-skin-accent), 0 8px 20px color-mix(in srgb, var(--nextclaw-skin-bg) 19%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="tab"] {
      color: var(--nextclaw-skin-muted) !important;
      border: 1px solid transparent !important;
      border-radius: 10px !important;
      padding-inline: 10px;
    }
    html.nextclaw-skin-studio [data-skin-role="tab"]:hover {
      color: var(--nextclaw-skin-text) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-accent) 8%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="tab"][data-skin-selected="true"] {
      color: var(--nextclaw-skin-text) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 25%, transparent) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-accent) 13%, transparent) !important;
      box-shadow: inset 0 -2px var(--nextclaw-skin-accent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="table"] {
      overflow: hidden;
      color: var(--nextclaw-skin-text) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 88%, transparent) !important;
      border: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 14%, var(--nextclaw-skin-border)) !important;
      border-radius: 13px !important;
    }
    html.nextclaw-skin-studio [data-skin-role="table"] th {
      color: var(--nextclaw-skin-text) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-accent) 9%, var(--nextclaw-skin-panel)) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="table"] th,
    html.nextclaw-skin-studio [data-skin-role="table"] td {
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 11%, var(--nextclaw-skin-border)) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="table"] tr:hover td {
      background: color-mix(in srgb, var(--nextclaw-skin-accent) 5%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="quote"] {
      color: color-mix(in srgb, var(--nextclaw-skin-text) 84%, var(--nextclaw-skin-muted)) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-accent) 6%, var(--nextclaw-skin-panel)) !important;
      border-left: 3px solid var(--nextclaw-skin-accent) !important;
      border-radius: 0 11px 11px 0;
    }
    html.nextclaw-skin-studio [data-skin-role="alert"] {
      color: var(--nextclaw-skin-text) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-secondary) 12%, var(--nextclaw-skin-panel)) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-secondary) 32%, var(--nextclaw-skin-border)) !important;
      border-radius: 13px !important;
    }
    html.nextclaw-skin-studio [data-skin-role="progress"] {
      accent-color: var(--nextclaw-skin-accent);
      color: var(--nextclaw-skin-accent) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-muted) 16%, var(--nextclaw-skin-panel)) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="dock"] {
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 94%, transparent) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 22%, transparent) !important;
      box-shadow: -12px 0 30px color-mix(in srgb, var(--nextclaw-skin-bg) 26%, transparent) !important;
      backdrop-filter: blur(18px) saturate(120%);
    }
    html.nextclaw-skin-studio [data-skin-role="dock"] button:hover {
      color: var(--nextclaw-skin-accent) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-accent) 13%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="overlay"] {
      color: var(--nextclaw-skin-text) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 96%, transparent) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 24%, transparent) !important;
      border-radius: 15px !important;
      box-shadow: 0 24px 70px color-mix(in srgb, var(--nextclaw-skin-bg) 62%, transparent) !important;
      backdrop-filter: blur(24px) saturate(120%);
    }
    html.nextclaw-skin-studio [data-skin-role="overlay"] [role="option"],
    html.nextclaw-skin-studio [data-skin-role="overlay"] [role="menuitem"],
    html.nextclaw-skin-studio [data-skin-role="overlay"] [data-radix-collection-item] {
      color: var(--nextclaw-skin-text) !important;
      border-radius: 10px !important;
    }
    html.nextclaw-skin-studio [data-skin-role="overlay"] [role="option"]:hover,
    html.nextclaw-skin-studio [data-skin-role="overlay"] [role="menuitem"]:hover,
    html.nextclaw-skin-studio [data-skin-role="overlay"] [data-highlighted] {
      color: var(--nextclaw-skin-text) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-accent) 12%, transparent) !important;
      outline: none !important;
    }
    html.nextclaw-skin-studio [data-skin-role="tooltip"] {
      color: var(--nextclaw-skin-bg) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-text) 91%, var(--nextclaw-skin-accent)) !important;
      border: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 38%, transparent) !important;
      border-radius: 9px !important;
      box-shadow: 0 10px 26px color-mix(in srgb, var(--nextclaw-skin-bg) 38%, transparent) !important;
    }
    html.nextclaw-skin-studio [data-sonner-toaster] [data-sonner-toast] {
      color: var(--nextclaw-skin-text) !important;
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 96%, transparent) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 24%, var(--nextclaw-skin-border)) !important;
      border-radius: 14px !important;
      box-shadow: 0 18px 48px color-mix(in srgb, var(--nextclaw-skin-bg) 42%, transparent) !important;
      backdrop-filter: blur(20px) saturate(118%);
    }
    html.nextclaw-skin-studio * {
      scrollbar-color: color-mix(in srgb, var(--nextclaw-skin-accent) 42%, transparent) transparent;
    }
    @keyframes nextclaw-skin-dragon-swim { to { transform: rotate(360deg); } }
    @keyframes nextclaw-skin-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
    @media (prefers-reduced-motion: reduce) {
      html.nextclaw-skin-studio [data-skin-role="run-indicator"]::before,
      html.nextclaw-skin-studio [data-skin-role="run-indicator"]::after,
      html.nextclaw-skin-studio [data-skin-role="skeleton"] { animation: none !important; }
    }
`;
  });
})();
