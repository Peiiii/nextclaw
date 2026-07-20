(() => {
  const factories = globalThis.__NEXTCLAW_SKIN_STYLE_FACTORIES__;
  factories.push((context) => {
    const {
      config,
      isConcept,
      signature,
      skinLabel,
      motifGlyph,
      craneArt,
      usesCraneMotif,
    } = context;
    if (!isConcept) return "";
    const motifArt = usesCraneMotif ? craneArt : "none";
    return `
    html.nextclaw-skin-studio [data-skin-role="page"] {
      background:
        radial-gradient(circle at 82% 15%, color-mix(in srgb, var(--nextclaw-skin-secondary) 8%, transparent), transparent 30%),
        repeating-linear-gradient(0deg, color-mix(in srgb, var(--nextclaw-skin-accent) 2.2%, transparent) 0 1px, transparent 1px 5px) !important;
    }
    html.nextclaw-skin-studio [data-skin-role="chat-header"]::before {
      content: "${skinLabel}";
      position: absolute;
      right: 34px;
      bottom: 9px;
      color: color-mix(in srgb, var(--nextclaw-skin-accent) 64%, transparent);
      font: 500 12px/1 "Snell Roundhand", "Segoe Script", cursive;
      letter-spacing: .06em;
      pointer-events: none;
    }
    html.nextclaw-skin-studio [data-skin-role="card"]::after {
      content: "✦";
      position: absolute;
      right: 16px;
      top: 13px;
      color: color-mix(in srgb, var(--nextclaw-skin-secondary) 52%, transparent);
      font: 13px/1 Georgia, serif;
      pointer-events: none;
    }
    html.nextclaw-skin-studio [data-skin-role="composer"] > div {
      border-color: color-mix(in srgb, var(--nextclaw-skin-accent) 42%, var(--nextclaw-skin-border)) !important;
      background:
        linear-gradient(90deg, color-mix(in srgb, var(--nextclaw-skin-panel) 94%, transparent), color-mix(in srgb, var(--nextclaw-skin-bg) 82%, transparent)) !important;
      box-shadow: 0 20px 55px color-mix(in srgb, var(--nextclaw-skin-accent) 12%, transparent), inset 0 0 0 5px color-mix(in srgb, var(--nextclaw-skin-panel) 44%, transparent) !important;
    }
    #nextclaw-skin-studio-chrome {
      position: fixed;
      z-index: 3;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
    }
    #nextclaw-skin-studio-chrome .nextclaw-skin-plaque {
      position: absolute;
      top: 19px;
      right: 30px;
      width: 210px;
      height: 34px;
      border: 1px solid color-mix(in srgb, var(--nextclaw-skin-accent) 30%, transparent);
      border-radius: 999px;
      background: color-mix(in srgb, var(--nextclaw-skin-panel) 58%, transparent);
      box-shadow: inset 0 1px color-mix(in srgb, white 48%, transparent);
      backdrop-filter: blur(12px);
    }
    #nextclaw-skin-studio-chrome .nextclaw-skin-plaque::before {
      content: "●  ${signature || config.name}  ·  ${skinLabel}";
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: color-mix(in srgb, var(--nextclaw-skin-accent) 72%, transparent);
      font: 700 8px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: .12em;
    }
    #nextclaw-skin-studio-chrome .nextclaw-skin-seal {
      position: absolute;
      right: 4.5%;
      bottom: 7.5%;
      width: 122px;
      height: 64px;
      background: ${motifArt} center / contain no-repeat;
      opacity: .18;
      transform: rotate(-5deg);
    }
    #nextclaw-skin-studio-chrome .nextclaw-skin-seal::after {
      content: "${motifGlyph}";
      color: color-mix(in srgb, var(--nextclaw-skin-accent) 46%, transparent);
      font: 18px/1 Georgia, serif;
      letter-spacing: .5em;
    }
    #nextclaw-skin-studio-chrome .nextclaw-skin-particles i {
      position: absolute;
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: var(--nextclaw-skin-accent);
      box-shadow: 0 0 9px color-mix(in srgb, var(--nextclaw-skin-accent) 48%, transparent);
      opacity: .27;
      animation: nextclaw-skin-concept-drift 6s ease-in-out infinite alternate;
    }
    #nextclaw-skin-studio-chrome .nextclaw-skin-particles i:nth-child(1) { left: 23%; top: 12%; }
    #nextclaw-skin-studio-chrome .nextclaw-skin-particles i:nth-child(2) { left: 41%; top: 7%; animation-delay: -2s; }
    #nextclaw-skin-studio-chrome .nextclaw-skin-particles i:nth-child(3) { left: 61%; top: 18%; animation-delay: -4s; }
    #nextclaw-skin-studio-chrome .nextclaw-skin-particles i:nth-child(4) { left: 82%; top: 11%; animation-delay: -1s; }
    #nextclaw-skin-studio-chrome .nextclaw-skin-particles i:nth-child(5) { left: 94%; top: 35%; animation-delay: -3s; }
    #nextclaw-skin-studio-chrome .nextclaw-skin-particles i:nth-child(6) { left: 70%; top: 68%; animation-delay: -5s; }
    #nextclaw-skin-studio-chrome .nextclaw-skin-particles i:nth-child(7) { left: 35%; top: 76%; animation-delay: -1.5s; }
    #nextclaw-skin-studio-chrome .nextclaw-skin-particles i:nth-child(8) { left: 88%; top: 84%; animation-delay: -3.5s; }
    @keyframes nextclaw-skin-concept-drift {
      from { transform: translate3d(0, 0, 0) scale(.8); opacity: .14; }
      to { transform: translate3d(4px, -10px, 0) scale(1.4); opacity: .46; }
    }
    @media (max-width: 900px) {
      #nextclaw-skin-studio-chrome .nextclaw-skin-plaque,
      #nextclaw-skin-studio-chrome .nextclaw-skin-seal { display: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      #nextclaw-skin-studio-chrome .nextclaw-skin-particles i { animation: none; }
    }
`;
  });
})();
