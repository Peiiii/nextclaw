(() => {
  const config = globalThis.__NEXTCLAW_SKIN_CONFIG__;
  if (!config || typeof config !== "object") {
    return;
  }

  const root = document.documentElement;
  const styleId = "nextclaw-skin-studio-style";
  const badgeId = "nextclaw-skin-studio-badge";
  const hexToHsl = (hex) => {
    const [r, g, b] = hex.match(/[a-f\d]{2}/gi).map((value) => parseInt(value, 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    const delta = max - min;
    if (delta === 0) {
      return `0 0% ${Math.round(lightness * 100)}%`;
    }
    const saturation = delta / (1 - Math.abs(2 * lightness - 1));
    const hue = max === r
      ? 60 * (((g - b) / delta) % 6)
      : max === g
        ? 60 * ((b - r) / delta + 2)
        : 60 * ((r - g) / delta + 4);
    return `${Math.round(hue < 0 ? hue + 360 : hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
  };
  const motifMarkup = {
    compass: `
      <circle cx="1190" cy="330" r="210"/><circle cx="1190" cy="330" r="132"/>
      <path d="M1190 88V572M948 330H1432M1019 159L1361 501M1361 159L1019 501"/>
      <path class="strong" d="M1190 166L1224 296L1354 330L1224 364L1190 494L1156 364L1026 330L1156 296Z"/>`,
    portal: `
      <circle cx="1180" cy="350" r="240"/><circle cx="1180" cy="350" r="170"/><circle class="strong" cx="1180" cy="350" r="94"/>
      <path d="M890 350H1470M1180 60V640"/>`,
    blossom: `
      <path d="M1180 350C1015 250 1010 105 1180 190C1350 105 1345 250 1180 350Z"/>
      <path d="M1180 350C1280 185 1425 180 1340 350C1425 520 1280 515 1180 350Z"/>
      <path class="strong" d="M1180 350C1345 450 1350 595 1180 510C1010 595 1015 450 1180 350Z"/>
      <circle cx="1180" cy="350" r="46"/>`,
    tide: `
      <path d="M650 300C805 175 940 430 1090 300S1380 180 1530 325"/>
      <path class="strong" d="M590 420C760 285 930 555 1100 410S1400 300 1560 445"/>
      <path d="M720 535C860 435 1010 625 1160 520S1415 430 1540 540"/>`,
    orbit: `
      <ellipse cx="1180" cy="350" rx="330" ry="112"/><ellipse cx="1180" cy="350" rx="330" ry="112" transform="rotate(58 1180 350)"/>
      <ellipse class="strong" cx="1180" cy="350" rx="330" ry="112" transform="rotate(-58 1180 350)"/>
      <circle cx="1180" cy="350" r="52"/><circle class="fill" cx="1438" cy="280" r="13"/>`,
    sunburst: `
      <circle cx="1190" cy="350" r="118"/><circle class="strong" cx="1190" cy="350" r="58"/>
      <path d="M1190 75V210M1190 490V625M915 350H1050M1330 350H1465M995 155L1090 250M1290 450L1385 545M1385 155L1290 250M1090 450L995 545"/>`
  };
  const art = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
      <defs>
        <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="${config.background}"/><stop offset="1" stop-color="${config.panel}"/>
        </linearGradient>
        <radialGradient id="glow"><stop stop-color="${config.secondary}" stop-opacity=".52"/><stop offset="1" stop-color="${config.secondary}" stop-opacity="0"/></radialGradient>
        <pattern id="grid" width="72" height="72" patternUnits="userSpaceOnUse"><path d="M72 0H0V72" fill="none" stroke="${config.secondary}" stroke-opacity=".12"/></pattern>
      </defs>
      <rect width="1600" height="900" fill="url(#base)"/><rect width="1600" height="900" fill="url(#grid)"/>
      <ellipse cx="1210" cy="330" rx="530" ry="430" fill="url(#glow)"/>
      <g fill="none" stroke="${config.secondary}" stroke-width="2" stroke-opacity=".42" stroke-linecap="round" stroke-linejoin="round">
        ${motifMarkup[config.motif] ?? motifMarkup.orbit}
      </g>
      <style>.strong{stroke:${config.accent};stroke-width:4;stroke-opacity:.82}.fill{fill:${config.accent};stroke:none}</style>
    </svg>`;
  const artUrl = config.image || URL.createObjectURL(new Blob([art], { type: "image/svg+xml" }));
  const isDark = config.mode === "dark";

  root.classList.add("nextclaw-skin-studio");
  root.dataset.nextclawSkin = config.id;
  root.style.setProperty("--nextclaw-skin-art", `url("${artUrl}")`);

  document.getElementById(styleId)?.remove();
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
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
        radial-gradient(circle at 84% 7%, color-mix(in srgb, var(--nextclaw-skin-secondary) 28%, transparent), transparent 31%),
        radial-gradient(circle at 9% 90%, color-mix(in srgb, var(--nextclaw-skin-accent) 16%, transparent), transparent 35%),
        var(--nextclaw-skin-bg) !important;
      color: var(--nextclaw-skin-text) !important;
    }
    html.nextclaw-skin-studio #root > div { background: transparent !important; }
    html.nextclaw-skin-studio #root aside:not([data-testid]) {
      position: relative;
      z-index: 4;
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 91%, transparent) !important;
      border-right: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 34%, transparent) !important;
      box-shadow: 16px 0 46px color-mix(in srgb, var(--nextclaw-skin-bg) 38%, transparent);
      backdrop-filter: blur(22px) saturate(125%);
    }
    html.nextclaw-skin-studio #root aside:not([data-testid])::after {
      content: "${config.name.toUpperCase().replace(/["\\]/g, "")}";
      position: absolute;
      right: 17px;
      bottom: 59px;
      color: color-mix(in srgb, var(--nextclaw-skin-accent) 68%, transparent);
      font: 800 8px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: .15em;
      pointer-events: none;
    }
    html.nextclaw-skin-studio #root aside:not([data-testid]) button {
      transition: color 160ms ease, background 160ms ease, transform 160ms ease !important;
    }
    html.nextclaw-skin-studio #root aside:not([data-testid]) button:hover {
      color: var(--nextclaw-skin-accent) !important;
      background: linear-gradient(90deg, color-mix(in srgb, var(--nextclaw-skin-accent) 17%, transparent), transparent) !important;
      transform: translateX(2px);
    }
    html.nextclaw-skin-studio #root section:has([data-testid="chat-conversation-header"]) {
      position: relative;
      isolation: isolate;
      background:
        linear-gradient(90deg, color-mix(in srgb, var(--nextclaw-skin-bg) 94%, transparent), color-mix(in srgb, var(--nextclaw-skin-bg) 57%, transparent) 56%, transparent),
        var(--nextclaw-skin-art) 72% 42% / cover no-repeat !important;
    }
    html.nextclaw-skin-studio #root section:has([data-testid="chat-conversation-header"]) > * { position: relative; z-index: 1; }
    html.nextclaw-skin-studio [data-testid="chat-conversation-header"],
    html.nextclaw-skin-studio [data-testid="side-dock"] {
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 84%, transparent) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 25%, transparent) !important;
      backdrop-filter: blur(20px) saturate(128%) !important;
    }
    html.nextclaw-skin-studio .nextclaw-chat-input-bar-shell > div,
    html.nextclaw-skin-studio article,
    html.nextclaw-skin-studio [class*="bg-card"] {
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 86%, transparent) !important;
      border-color: color-mix(in srgb, var(--nextclaw-skin-border) 72%, transparent) !important;
      box-shadow: 0 18px 48px color-mix(in srgb, var(--nextclaw-skin-bg) 24%, transparent) !important;
      backdrop-filter: blur(18px) saturate(120%);
    }
    html.nextclaw-skin-studio .nextclaw-chat-input-bar-shell > div {
      border-radius: 20px !important;
      box-shadow: 0 22px 58px color-mix(in srgb, var(--nextclaw-skin-bg) 38%, transparent), inset 0 1px color-mix(in srgb, white 14%, transparent) !important;
    }
    #nextclaw-skin-studio-badge {
      position: fixed;
      top: 15px;
      right: 76px;
      z-index: 80;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 8px 13px;
      border: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 42%, transparent);
      border-radius: 999px;
      color: var(--nextclaw-skin-accent);
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 78%, transparent);
      box-shadow: 0 12px 36px color-mix(in srgb, var(--nextclaw-skin-bg) 35%, transparent);
      backdrop-filter: blur(18px) saturate(128%);
      pointer-events: none;
      font: 800 8px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: .14em;
    }
    #nextclaw-skin-studio-badge i {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--nextclaw-skin-secondary);
      box-shadow: 0 0 13px var(--nextclaw-skin-secondary);
      animation: nextclaw-skin-pulse 2.2s ease-in-out infinite;
    }
    @keyframes nextclaw-skin-pulse { 0%,100%{opacity:.58;transform:scale(.84)} 50%{opacity:1;transform:scale(1.12)} }
    @media (max-width: 900px) { #nextclaw-skin-studio-badge { display: none; } }
    @media (prefers-reduced-motion: reduce) { #nextclaw-skin-studio-badge i { animation: none; } }
  `;
  document.head.appendChild(style);

  document.getElementById(badgeId)?.remove();
  const badge = document.createElement("div");
  badge.id = badgeId;
  badge.setAttribute("aria-hidden", "true");
  const pulse = document.createElement("i");
  const label = document.createElement("span");
  label.textContent = `${config.name} · NEXTCLAW`;
  badge.append(pulse, label);
  document.body.appendChild(badge);

  globalThis.__NEXTCLAW_UI_SKIN__ = Object.freeze({
    id: config.id,
    name: config.name,
    version: 1,
    source: "NextClaw Skin Studio"
  });
})();
