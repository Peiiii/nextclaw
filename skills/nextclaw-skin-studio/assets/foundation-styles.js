(() => {
  const factories = globalThis.__NEXTCLAW_SKIN_STYLE_FACTORIES__ = [];
  factories.push((context) => {
    const {
      config,
      hexToHsl,
      isDark,
      isConcept,
      signature,
      tagline,
      cardCaption,
      motifGlyph,
      usesCraneMotif,
      craneArt,
      headerMix,
      surfaceMix,
      mainOverlay,
    } = context;
    return `
    :root.nextclaw-skin-studio {
      color-scheme: ${isDark ? "dark" : "light"};
      --background: ${hexToHsl(config.background)};
      --background-secondary: ${hexToHsl(config.panel)};
      --background-tertiary: ${hexToHsl(config.panel)};
      --foreground: ${hexToHsl(config.text)};
      --foreground-secondary: ${hexToHsl(config.muted)};
      --foreground-tertiary: ${hexToHsl(config.muted)};
      --foreground-muted: ${hexToHsl(config.muted)};
      --primary: ${hexToHsl(config.accent)};
      --primary-hover: ${hexToHsl(config.secondary)};
      --primary-active: ${hexToHsl(config.accent)};
      --primary-foreground: ${hexToHsl(config.background)};
      --secondary: ${hexToHsl(config.panel)};
      --secondary-hover: ${hexToHsl(config.border)};
      --secondary-foreground: ${hexToHsl(config.text)};
      --accent: ${hexToHsl(config.panel)};
      --accent-foreground: ${hexToHsl(config.accent)};
      --muted: ${hexToHsl(config.panel)};
      --muted-foreground: ${hexToHsl(config.muted)};
      --ring: ${hexToHsl(config.accent)};
      --input: ${hexToHsl(config.panel)};
      --input-border: ${hexToHsl(config.border)};
      --input-focus: ${hexToHsl(config.accent)};
      --border: ${hexToHsl(config.border)};
      --border-hover: ${hexToHsl(config.secondary)};
      --border-active: ${hexToHsl(config.accent)};
      --card: ${hexToHsl(config.panel)};
      --card-foreground: ${hexToHsl(config.text)};
      --card-border: ${hexToHsl(config.border)};
      --popover: ${hexToHsl(config.panel)};
      --popover-foreground: ${hexToHsl(config.text)};
      --radius: 0.9rem;
      --nextclaw-skin-bg: ${config.background};
      --nextclaw-skin-panel: ${config.panel};
      --nextclaw-skin-text: ${config.text};
      --nextclaw-skin-muted: ${config.muted};
      --nextclaw-skin-accent: ${config.accent};
      --nextclaw-skin-secondary: ${config.secondary};
      --nextclaw-skin-border: ${config.border};
    }
    html.nextclaw-skin-studio body {
      background:
        linear-gradient(90deg, color-mix(in srgb, var(--nextclaw-skin-bg) 96%, transparent) 0 19%, color-mix(in srgb, var(--nextclaw-skin-bg) 62%, transparent) 43%, transparent 78%),
        linear-gradient(180deg, transparent 42%, color-mix(in srgb, var(--nextclaw-skin-bg) 78%, transparent) 100%),
        ${isConcept ? "var(--nextclaw-skin-bg)" : "var(--nextclaw-skin-art) var(--nextclaw-skin-art-position) / var(--nextclaw-skin-art-size) fixed no-repeat"} !important;
      color: var(--nextclaw-skin-text) !important;
      font-family: "Avenir Next", "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif;
    }
    html.nextclaw-skin-studio h1,
    html.nextclaw-skin-studio h2,
    html.nextclaw-skin-studio h3 {
      color: var(--nextclaw-skin-text);
      letter-spacing: -.018em;
    }
    html.nextclaw-skin-studio #root > div { background: transparent !important; }
    html.nextclaw-skin-studio #root section:has([data-testid="chat-conversation-header"]) {
      position: relative;
      isolation: isolate;
      background:
        radial-gradient(circle at 88% 8%, color-mix(in srgb, var(--nextclaw-skin-secondary) 15%, transparent), transparent 32%),
        radial-gradient(circle at 4% 78%, color-mix(in srgb, var(--nextclaw-skin-accent) 8%, transparent), transparent 36%),
        ${mainOverlay},
        ${isConcept ? "var(--nextclaw-skin-bg)" : "var(--nextclaw-skin-art) var(--nextclaw-skin-art-position) / var(--nextclaw-skin-art-size) no-repeat"} !important;
    }
    ${isConcept ? `
    html.nextclaw-skin-studio[data-nextclaw-skin-page="home"] #root section:has([data-testid="chat-conversation-header"])::before {
      content: "";
      position: absolute;
      z-index: 0;
      top: -18px;
      right: -36px;
      width: min(60%, 780px);
      height: min(72vh, 620px);
      min-height: 330px;
      background: var(--nextclaw-skin-art) var(--nextclaw-skin-art-position) / var(--nextclaw-skin-art-size) no-repeat;
      opacity: .96;
      filter: saturate(1.04) contrast(1.02);
      pointer-events: none;
      -webkit-mask-image: linear-gradient(to right, transparent 0%, black 22%, black 100%), linear-gradient(to bottom, black 0%, black 72%, transparent 100%);
      -webkit-mask-composite: source-in;
      mask-image: linear-gradient(to right, transparent 0%, black 22%, black 100%), linear-gradient(to bottom, black 0%, black 72%, transparent 100%);
      mask-composite: intersect;
    }
    html.nextclaw-skin-studio[data-nextclaw-skin="people-ai-red"][data-nextclaw-skin-page="home"] #root section:has([data-testid="chat-conversation-header"])::before {
      height: min(36vh, 260px);
      -webkit-mask-image: linear-gradient(to right, transparent 0%, black 22%, black 100%), linear-gradient(to bottom, black 0%, black 42%, transparent 72%);
      mask-image: linear-gradient(to right, transparent 0%, black 22%, black 100%), linear-gradient(to bottom, black 0%, black 42%, transparent 72%);
    }
    html.nextclaw-skin-studio[data-nextclaw-skin-page="chat-session"] [data-skin-role="page"]::before {
      content: "";
      position: absolute;
      z-index: 0;
      inset: 0;
      background: var(--nextclaw-skin-art) var(--nextclaw-skin-art-position) / auto clamp(820px, 108vh, 1320px) no-repeat;
      opacity: .16;
      filter: saturate(.88) contrast(1.035);
      pointer-events: none;
      -webkit-mask-image: linear-gradient(to right, transparent 0%, transparent 31%, rgba(0, 0, 0, .44) 52%, black 78%, black 100%), linear-gradient(to bottom, black 0%, black 76%, rgba(0, 0, 0, .72) 90%, transparent 100%);
      -webkit-mask-composite: source-in;
      mask-image: linear-gradient(to right, transparent 0%, transparent 31%, rgba(0, 0, 0, .44) 52%, black 78%, black 100%), linear-gradient(to bottom, black 0%, black 76%, rgba(0, 0, 0, .72) 90%, transparent 100%);
      mask-composite: intersect;
    }
    html.nextclaw-skin-studio[data-nextclaw-skin-page="skills"] [data-skin-role="page"]::before {
      content: "";
      position: absolute;
      z-index: 0;
      top: 48px;
      right: -26px;
      width: min(47%, 560px);
      height: min(44vh, 330px);
      background: var(--nextclaw-skin-art) var(--nextclaw-skin-art-position) / var(--nextclaw-skin-art-size) no-repeat;
      opacity: .105;
      filter: saturate(.84) contrast(1.04);
      pointer-events: none;
      -webkit-mask-image: linear-gradient(to right, transparent 0%, black 30%, black 100%), linear-gradient(to bottom, black 0%, black 60%, transparent 82%);
      -webkit-mask-composite: source-in;
      mask-image: linear-gradient(to right, transparent 0%, black 30%, black 100%), linear-gradient(to bottom, black 0%, black 60%, transparent 82%);
      mask-composite: intersect;
    }
    @media (max-width: 1050px) {
      html.nextclaw-skin-studio[data-nextclaw-skin-page="chat-session"] [data-skin-role="page"]::before {
        background-size: auto clamp(680px, 98vh, 980px);
        opacity: .1;
        -webkit-mask-image: linear-gradient(to right, transparent 0%, transparent 24%, black 72%, black 100%), linear-gradient(to bottom, black 0%, black 74%, transparent 100%);
        mask-image: linear-gradient(to right, transparent 0%, transparent 24%, black 72%, black 100%), linear-gradient(to bottom, black 0%, black 74%, transparent 100%);
      }
    }
    @media (max-width: 700px) {
      html.nextclaw-skin-studio[data-nextclaw-skin-page="chat-session"] [data-skin-role="page"]::before {
        background-size: auto 82vh;
        opacity: .055;
      }
    }` : ""}
    html.nextclaw-skin-studio #root section:has([data-testid="chat-conversation-header"]) > * { position: relative; z-index: 1; }
    ${isConcept ? `
    html.nextclaw-skin-studio[data-nextclaw-skin-page="home"] #root section:has([data-testid="chat-conversation-header"]) div:has(> h2):has(> p) {
      width: min(56%, 430px);
      text-align: left;
    }
    ${signature ? `
    html.nextclaw-skin-studio[data-nextclaw-skin-page="home"] #root section:has([data-testid="chat-conversation-header"]) div:has(> h2):has(> p)::before {
      content: "${signature}";
      display: block;
      margin: 0 0 14px;
      color: var(--nextclaw-skin-accent);
      font: 500 26px/1.1 "Snell Roundhand", "Segoe Script", "Bradley Hand", cursive;
      letter-spacing: .035em;
      transform: rotate(-3deg);
      transform-origin: left center;
    }
    html.nextclaw-skin-studio[data-nextclaw-skin-page="home"] #root section:has([data-testid="chat-conversation-header"]) div:has(> h2):has(> p)::after {
      content: "${tagline}";
      display: inline-block;
      margin-top: 12px;
      color: var(--nextclaw-skin-accent);
      font: 700 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: .12em;
      opacity: .72;
    }` : ""}
    html.nextclaw-skin-studio[data-nextclaw-skin-page="home"] #root section:has([data-testid="chat-conversation-header"])::after {
      content: "${motifGlyph}";
      position: absolute;
      z-index: 0;
      top: 112px;
      right: 4.5%;
      color: color-mix(in srgb, var(--nextclaw-skin-accent) 58%, transparent);
      font: 500 18px/1 "Snell Roundhand", "Segoe Script", cursive;
      letter-spacing: .34em;
      transform: rotate(-7deg);
      pointer-events: none;
    }
    ${config.details?.sticker ? `
    html.nextclaw-skin-studio:not([data-nextclaw-skin-page="chat-session"]) body::before {
      content: "";
      position: fixed;
      z-index: 3;
      top: 65px;
      right: 24%;
      width: 150px;
      height: 70px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: color-mix(in srgb, var(--nextclaw-skin-accent) 76%, transparent);
      background: ${usesCraneMotif ? craneArt : "none"} center / contain no-repeat;
      opacity: .32;
      transform: rotate(4deg);
      pointer-events: none;
      font: 600 24px/1 "Snell Roundhand", "Segoe Script", "Apple Symbols", cursive;
      letter-spacing: .16em;
    }
    html.nextclaw-skin-studio[data-nextclaw-skin-page="home"] body::after {
      content: "${cardCaption}";
      position: fixed;
      z-index: 20;
      right: 82px;
      bottom: 30px;
      box-sizing: border-box;
      width: 86px;
      height: 112px;
      padding-top: 84px;
      color: var(--nextclaw-skin-accent);
      background: var(--nextclaw-skin-art) var(--nextclaw-skin-art-position) / auto 430% no-repeat;
      border: 7px solid color-mix(in srgb, white 94%, var(--nextclaw-skin-panel));
      border-bottom-width: 22px;
      box-shadow: 0 13px 30px color-mix(in srgb, var(--nextclaw-skin-bg) 48%, transparent);
      transform: rotate(-7deg);
      pointer-events: none;
      font: 600 8px/1 "Snell Roundhand", "Segoe Script", cursive;
      text-align: center;
    }` : ""}
    @media (max-width: 1050px) {
      html.nextclaw-skin-studio[data-nextclaw-skin-page="home"] #root section:has([data-testid="chat-conversation-header"])::before { opacity: .42; }
      html.nextclaw-skin-studio:not([data-nextclaw-skin-page="chat-session"]) body::before,
      html.nextclaw-skin-studio[data-nextclaw-skin-page="home"] body::after { display: none; }
      html.nextclaw-skin-studio[data-nextclaw-skin-page="home"] #root section:has([data-testid="chat-conversation-header"]) div:has(> h2):has(> p) {
        width: 100%;
        text-align: center;
      }
    }` : ""}
    html.nextclaw-skin-studio [data-testid="chat-conversation-header"] {
      background: transparent !important;
      border-color: transparent !important;
      box-shadow: none !important;
      backdrop-filter: none !important;
    }
    html.nextclaw-skin-studio [data-testid="side-dock"] {
      background: color-mix(in srgb, var(--nextclaw-skin-panel) ${headerMix}%, transparent) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 25%, transparent) !important;
      backdrop-filter: blur(20px) saturate(128%) !important;
    }
    html.nextclaw-skin-studio #root section:has([data-testid="chat-conversation-header"]) button svg {
      color: color-mix(in srgb, var(--nextclaw-skin-accent) 82%, currentColor) !important;
    }
    html.nextclaw-skin-studio #root section:has([data-testid="chat-conversation-header"]) button.min-w-0.rounded-xl {
      border-radius: 18px !important;
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 94%, transparent) !important;
      box-shadow: 0 12px 30px color-mix(in srgb, var(--nextclaw-skin-bg) 36%, transparent) !important;
      transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease !important;
    }
    html.nextclaw-skin-studio #root section:has([data-testid="chat-conversation-header"]) button.min-w-0.rounded-xl > div:first-child {
      border-radius: 999px !important;
      color: var(--nextclaw-skin-bg) !important;
      background: linear-gradient(145deg, var(--nextclaw-skin-accent), var(--nextclaw-skin-secondary)) !important;
      box-shadow: 0 6px 16px color-mix(in srgb, var(--nextclaw-skin-accent) 28%, transparent);
    }
    html.nextclaw-skin-studio #root section:has([data-testid="chat-conversation-header"]) button.min-w-0.rounded-xl:hover {
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 48%, transparent) !important;
      box-shadow: 0 16px 34px color-mix(in srgb, var(--nextclaw-skin-bg) 42%, transparent) !important;
      transform: translateY(-2px);
    }
    html.nextclaw-skin-studio .nextclaw-chat-input-bar-shell > div,
    html.nextclaw-skin-studio [data-skin-role="card"],
    html.nextclaw-skin-studio [class*="bg-card"] {
      background: color-mix(in srgb, var(--nextclaw-skin-panel) ${surfaceMix}%, transparent) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-border) 72%, transparent) !important;
      box-shadow: 0 18px 48px color-mix(in srgb, var(--nextclaw-skin-bg) 24%, transparent) !important;
      backdrop-filter: blur(18px) saturate(120%);
    }
    html.nextclaw-skin-studio .nextclaw-chat-input-bar-shell > div {
      border-radius: 20px !important;
      box-shadow: 0 22px 58px color-mix(in srgb, var(--nextclaw-skin-bg) 38%, transparent), inset 0 1px color-mix(in srgb, white 14%, transparent) !important;
    }
    html.nextclaw-skin-studio ::selection {
      color: var(--nextclaw-skin-bg);
      background: color-mix(in srgb, var(--nextclaw-skin-accent) 76%, transparent);
    }
`;
  });
})();
