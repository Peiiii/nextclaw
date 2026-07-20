(() => {
  const config = globalThis.__NEXTCLAW_SKIN_CONFIG__;
  if (!config || typeof config !== "object" || typeof config.image !== "string") {
    return;
  }
  const projectCss = typeof globalThis.__NEXTCLAW_SKIN_PROJECT_CSS__ === "string"
    ? globalThis.__NEXTCLAW_SKIN_PROJECT_CSS__
    : "";

  const root = document.documentElement;
  const styleId = "nextclaw-skin-studio-style";
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
  const isDark = config.mode === "dark";
  const isConcept = config.asset?.kind === "concept-preview";
  const escapeCssContent = (value) => String(value ?? "").replace(/["\\\n\r]/g, " ");
  const signature = escapeCssContent(config.details?.signature);
  const tagline = escapeCssContent(config.details?.tagline);
  const skinLabel = escapeCssContent(config.details?.label || config.name);
  const cardCaption = escapeCssContent(config.details?.cardCaption || config.details?.label || config.name);
  const motifGlyph = escapeCssContent({
    bolt: "⚡　⌁",
    coin: "◉　元",
    heart: "♡　✦",
    music: "♫　⋆",
    orbit: "◌　✦",
    rose: "❀　♡",
    spark: "⚡　✦",
    star: "✦　⋆",
  }[config.details?.motif] || "");
  const usesCraneMotif = config.details?.motif === "crane";
  const craneArt = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 84"><g fill="none" stroke="${config.accent}" stroke-linecap="round" stroke-linejoin="round"><path d="M4 51 53 9 44 43l65-23-39 38 42 16-60-12-24 17 10-31Z"/><path d="m53 9 17 49M44 43l26 15M70 58l29-9M118 27c20 10 34 11 58 3" stroke-dasharray="2 7"/><path d="m131 15 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/><circle cx="157" cy="56" r="2"/></g></svg>`)}")`;
  const dragonArt = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><filter id="ink" x="-18%" y="-18%" width="136%" height="136%"><feTurbulence type="fractalNoise" baseFrequency=".078" numOctaves="2" seed="13" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale=".9"/></filter></defs><g filter="url(#ink)"><path d="M36 8.5C28.1 2.6 16.7 3.5 9.8 10.7 2.9 18 3.4 29.4 11 36c5.5 4.8 13.2 6 19.8 3.1" fill="none" stroke="${config.accent}" stroke-width="4.4" stroke-linecap="round" opacity=".9"/><path d="M34.8 9.7C27.8 4.9 18.1 5.8 12 12.1 6 18.3 6.4 28 12.9 33.7c4.7 4.1 11.1 5.2 16.8 2.9" fill="none" stroke="${config.accent}" stroke-width=".9" stroke-linecap="round" opacity=".35"/><path d="M30 37c5.1-2.5 7.8-7.4 7.6-14.1 3.1 5.1 3.2 10.1.1 14.8 3-.9 5.6-3 7.8-6.2-.9 7.7-6.1 12.5-14.2 13.4-6 .7-10.8-1.2-14.1-5.7 4.8 2 9.1 1.2 12.8-2.2Z" fill="${config.text}" opacity=".62"/><path d="M30.7 38.3c3.7-2.4 5.8-5.7 6.2-9.8" fill="none" stroke="${config.background}" stroke-width="1.35" stroke-linecap="round" opacity=".72"/><path d="M36 8.5c2.3-1.2 4-3.2 5.1-5.8M11.1 36.1c-2.3.6-4.5.4-6.5-.5" fill="none" stroke="${config.accent}" stroke-width="1.25" stroke-linecap="round" opacity=".52"/></g></svg>`)}")`;
  const embeddedImage = /^data:([^;,]+);base64,/.exec(config.image);
  let artSource = config.image;
  let artObjectUrl;
  if (embeddedImage) {
    const binary = atob(config.image.slice(embeddedImage[0].length));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    artObjectUrl = URL.createObjectURL(new Blob([bytes], { type: embeddedImage[1] }));
    artSource = artObjectUrl;
  }

  class SkinRuntime {
    cleanups = [];
    frame = 0;
    roleTargets = new Set();
    selectedTargets = new Set();

    setRole = (element, role) => {
      if (!(element instanceof HTMLElement)) return;
      this.roleTargets.add(element);
      if (element.dataset.skinRole !== role) element.dataset.skinRole = role;
    };

    setSelected = (element) => {
      if (!(element instanceof HTMLElement)) return;
      this.selectedTargets.add(element);
      if (element.dataset.skinSelected !== "true") element.dataset.skinSelected = "true";
    };

    ensureChrome = () => {
      const chromeId = "nextclaw-skin-studio-chrome";
      const existing = document.getElementById(chromeId);
      if (!isConcept) {
        existing?.remove();
        return;
      }
      if (existing) return;
      const chrome = document.createElement("div");
      chrome.id = chromeId;
      chrome.setAttribute("aria-hidden", "true");
      chrome.innerHTML = '<div class="nextclaw-skin-plaque"></div><div class="nextclaw-skin-particles"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="nextclaw-skin-seal"></div>';
      document.body.appendChild(chrome);
      this.cleanups.push(() => chrome.remove());
    };

    markSurfaces = () => {
      this.roleTargets.clear();
      this.selectedTargets.clear();
      const pathParts = location.pathname.split("/").filter(Boolean);
      const route = pathParts[0] || "home";
      const pageKind = route === "chat" ? (pathParts[1] ? "chat-session" : "home") : route;
      root.dataset.nextclawSkinPage = pageKind;
      const shell = document.querySelector("#root > div");
      const [sidebar, dock] = document.querySelectorAll("#root aside");
      const visibleArea = (element) => {
        const rect = element.getBoundingClientRect();
        const width = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
        const height = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
        return width * height;
      };
      const page = Array.from(document.querySelectorAll("#root main, #root section"))
        .filter((element) => !element.closest("aside"))
        .sort((left, right) => visibleArea(right) - visibleArea(left))[0];
      this.setRole(shell, "shell");
      this.setRole(sidebar, "sidebar");
      this.setRole(dock, "dock");
      this.setRole(page, "page");

      const sidebarChildren = Array.from(sidebar?.children || []);
      const sessionScroll = sidebarChildren.find((element) => element.matches(".custom-scrollbar.overflow-y-auto"));
      if (sessionScroll) {
        const sessionScrollIndex = sidebarChildren.indexOf(sessionScroll);
        const sidebarRoles = new Map([
          [0, "sidebar-brand"],
          [1, "sidebar-new-task"],
          [2, "sidebar-search"],
          [3, "sidebar-primary-nav"],
          [sessionScrollIndex - 2, "sidebar-divider"],
          [sessionScrollIndex - 1, "sidebar-session-heading"],
          [sessionScrollIndex, "sidebar-session-scroll"],
          [sessionScrollIndex + 1, "sidebar-footer"],
        ]);
        sidebarRoles.forEach((role, index) => this.setRole(sidebarChildren[index], role));
      }
      Array.from(sessionScroll?.firstElementChild?.children || []).forEach((group) => {
        this.setRole(group, "session-group");
        this.setRole(group.children[0], "session-group-label");
        this.setRole(group.children[1], "session-group-list");
      });

      sidebar?.querySelectorAll("a").forEach((element) => this.setRole(element, "nav-item"));
      sidebar?.querySelectorAll("button").forEach((element) => {
        if (element.matches(".w-full.text-left")) {
          const item = element.parentElement?.parentElement;
          this.setRole(item, "session-item");
          this.setRole(element, "session-content");
          if (item?.classList.contains("font-semibold") || item?.className.includes("bg-gray-200/80")) {
            this.setSelected(item);
          }
          return;
        }
        const role = element.getAttribute("aria-label") && element.matches("[class*='h-6'], [class*='h-7']")
          ? "icon-button"
          : "nav-item";
        this.setRole(element, role);
      });
      page?.querySelectorAll("button").forEach((element) => this.setRole(element, "button"));
      page?.querySelectorAll("a[href]").forEach((element) => this.setRole(element, "link"));
      const cardSelector = pageKind === "skills" ? "article, button.group" : "article[data-chat-message-layout='flat']";
      page?.querySelectorAll(cardSelector).forEach((element) => this.setRole(element, "card"));
      page?.querySelectorAll("input, textarea, select, [contenteditable='true']").forEach((element) => this.setRole(element, "input"));
      page?.querySelectorAll("button[type='submit']").forEach((element) => this.setRole(element, "primary-action"));
      page?.querySelectorAll("[role='combobox']").forEach((element) => this.setRole(element, "select"));
      page?.querySelectorAll("[role='switch']").forEach((element) => this.setRole(element, "switch"));
      page?.querySelectorAll("[role='radio'], input[type='radio'], input[type='checkbox']").forEach((element) => this.setRole(element, "choice"));
      page?.querySelectorAll("[role='tab'], button[aria-pressed]").forEach((element) => this.setRole(element, "tab"));
      page?.querySelectorAll("[role='separator'], hr").forEach((element) => this.setRole(element, "separator"));
      page?.querySelectorAll("table").forEach((element) => this.setRole(element, "table"));
      page?.querySelectorAll("blockquote").forEach((element) => this.setRole(element, "quote"));
      page?.querySelectorAll("kbd").forEach((element) => this.setRole(element, "keycap"));
      page?.querySelectorAll("[data-slot='badge'], span[class*='rounded-full'][class*='text-xs']")
        .forEach((element) => this.setRole(element, "badge"));
      page?.querySelectorAll("[class*='animate-pulse'], [data-loading='true']")
        .forEach((element) => this.setRole(element, "skeleton"));
      page?.querySelectorAll("[role='alert']").forEach((element) => this.setRole(element, "alert"));
      page?.querySelectorAll("progress, [role='progressbar']").forEach((element) => this.setRole(element, "progress"));
      if (pageKind === "skills") {
        page?.querySelectorAll("section").forEach((element) => {
          if (element !== page && element.getBoundingClientRect().width > 420) this.setRole(element, "collection-section");
        });
      }
      if (!["chat-session", "home", "skills"].includes(pageKind)) {
        page?.querySelectorAll("section").forEach((element) => this.setRole(element, "settings-section"));
      }
      document.querySelectorAll("[aria-current='page'], [aria-pressed='true'], [data-state='active']")
        .forEach(this.setSelected);
      if (pageKind === "skills") document.querySelectorAll("article").forEach((article) => {
        this.setRole(article.querySelector("[class*='h-10'][class*='w-10']"), "card-icon");
        article.querySelectorAll("button").forEach((element) => this.setRole(element, "card-action"));
      });
      page?.querySelectorAll("button.group").forEach((card) => {
        this.setRole(card.querySelector("span:has(svg)"), "card-icon");
      });
      document.querySelectorAll("[role='dialog'], [role='menu'], [data-radix-popper-content-wrapper]")
        .forEach((element) => this.setRole(element, "overlay"));
      document.querySelectorAll("[role='tooltip']").forEach((element) => this.setRole(element, "tooltip"));
      document.querySelectorAll("[data-state='checked'], [aria-checked='true']")
        .forEach(this.setSelected);
      sidebar?.querySelectorAll("svg.animate-spin").forEach((element) => {
        this.setRole(element.parentElement, "run-indicator");
      });
      this.setRole(document.querySelector("[data-testid='chat-conversation-header']"), "chat-header");
      this.setRole(document.querySelector(".nextclaw-chat-input-bar-shell"), "composer");
      page?.querySelectorAll(".nextclaw-chat-message-user").forEach((element) => this.setRole(element, "user-message"));
      page?.querySelectorAll("[data-testid='chat-message-avatar-assistant']").forEach((element) => this.setRole(element, "assistant-avatar"));
      page?.querySelectorAll("[data-chat-process-meta-row]").forEach((element) => this.setRole(element, "process-row"));
      page?.querySelectorAll("article[data-chat-message-layout='flat'] pre").forEach((element) => this.setRole(element, "code-block"));
      document.querySelectorAll("[data-skin-role]").forEach((element) => {
        if (!this.roleTargets.has(element)) delete element.dataset.skinRole;
      });
      document.querySelectorAll("[data-skin-selected]").forEach((element) => {
        if (!this.selectedTargets.has(element)) delete element.dataset.skinSelected;
      });
    };

    schedule = () => {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.markSurfaces();
      });
    };

    start = () => {
      this.ensureChrome();
      this.markSurfaces();
      const observer = new MutationObserver(this.schedule);
      observer.observe(document.body, { childList: true, subtree: true });
      this.cleanups.push(() => observer.disconnect());
      const hydrationInterval = window.setInterval(this.markSurfaces, 250);
      const hydrationTimeout = window.setTimeout(() => window.clearInterval(hydrationInterval), 10_000);
      this.cleanups.push(() => {
        window.clearInterval(hydrationInterval);
        window.clearTimeout(hydrationTimeout);
      });
      window.addEventListener("popstate", this.schedule);
      this.cleanups.push(() => window.removeEventListener("popstate", this.schedule));
    };

    dispose = () => {
      if (this.frame) cancelAnimationFrame(this.frame);
      this.cleanups.splice(0).forEach((cleanup) => cleanup());
      document.querySelectorAll("[data-skin-role], [data-skin-selected]").forEach((element) => {
        delete element.dataset.skinRole;
        delete element.dataset.skinSelected;
      });
    };
  }
  const focusX = Math.round((config.art?.focusX ?? 0.68) * 100);
  const focusY = Math.round((config.art?.focusY ?? 0.32) * 100);
  const artSize = isConcept ? `auto ${config.art?.zoom ?? 270}%` : "cover";
  const headerMix = isConcept ? 94 : 84;
  const surfaceMix = isConcept ? 95 : 86;
  const mainOverlay = isConcept
    ? `linear-gradient(120deg, color-mix(in srgb, var(--nextclaw-skin-bg) 96%, transparent), color-mix(in srgb, var(--nextclaw-skin-bg) 88%, transparent) 48%, color-mix(in srgb, var(--nextclaw-skin-bg) 54%, transparent) 72%, transparent)`
    : `linear-gradient(90deg, color-mix(in srgb, var(--nextclaw-skin-bg) 94%, transparent), color-mix(in srgb, var(--nextclaw-skin-bg) 50%, transparent) 48%, transparent 78%),
        linear-gradient(180deg, transparent 48%, color-mix(in srgb, var(--nextclaw-skin-bg) 76%, transparent))`;

  const styleFactories = globalThis.__NEXTCLAW_SKIN_STYLE_FACTORIES__;
  if (!Array.isArray(styleFactories) || styleFactories.length !== 6) {
    throw new Error("NextClaw skin style assets are incomplete");
  }
  const styleContext = {
    config,
    hexToHsl,
    isDark,
    isConcept,
    signature,
    tagline,
    cardCaption,
    skinLabel,
    motifGlyph,
    usesCraneMotif,
    craneArt,
    dragonArt,
    headerMix,
    surfaceMix,
    mainOverlay,
  };

  root.classList.add("nextclaw-skin-studio");
  root.dataset.nextclawSkin = config.id;
  globalThis.__NEXTCLAW_SKIN_RUNTIME__?.dispose?.();
  const runtime = new SkinRuntime();
  if (artObjectUrl) runtime.cleanups.push(() => URL.revokeObjectURL(artObjectUrl));
  runtime.start();
  globalThis.__NEXTCLAW_SKIN_RUNTIME__ = runtime;
  root.style.setProperty("--nextclaw-skin-art", `url("${artSource}")`);
  root.style.setProperty("--nextclaw-skin-art-position", `${focusX}% ${focusY}%`);
  root.style.setProperty("--nextclaw-skin-art-size", artSize);

  document.getElementById(styleId)?.remove();
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `${styleFactories.map((factory) => factory(styleContext)).join("\n")}\n${projectCss}`;
  delete globalThis.__NEXTCLAW_SKIN_STYLE_FACTORIES__;
  delete globalThis.__NEXTCLAW_SKIN_PROJECT_CSS__;
  document.head.appendChild(style);

  globalThis.__NEXTCLAW_UI_SKIN__ = Object.freeze({
    id: config.id,
    name: config.name,
    version: 3,
    source: config.assetSource
  });
})();
