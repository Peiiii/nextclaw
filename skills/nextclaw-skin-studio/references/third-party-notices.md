# Third-party notices

NextClaw Skin Studio adapts visual material from [Fei-Away/Codex-Dream-Skin](https://github.com/Fei-Away/Codex-Dream-Skin) at pinned commit `3af1d6d62f3a0388cc640d2f497ac3100998938e`. Historical labels such as `Jackson Yee · 清透定制`, `Dilraba · 紫夜限定`, `Miku · 初音未来`, and `KUN · 舞台黑金` are evidenced by upstream commit `7777e9f601ccac2ec517eca6763d09496dbd7777`.

The Marketplace package does not contain those images. When the user explicitly applies a source skin, `scripts/skin.mjs` downloads the single pinned upstream image, verifies its recorded SHA-256 digest, and embeds the bytes into the local `ui-inject.js`. The browser does not load a remote image or execute remote code after activation. Users may instead supply a local clone with `--source-dir`; integrity verification remains mandatory.

The upstream MIT license covers software and documentation, but the upstream `macos/NOTICE.md` explicitly excludes celebrity, character, franchise, trademark, and user-supplied imagery from that software license. Repository inclusion does not grant likeness, copyright, trademark, model-output, commercial-use, or redistribution rights. Applying a portrait or character skin is the user's choice and responsibility and does not imply endorsement by the depicted person, rights holder, OpenAI, Codex, or NextClaw.

The upstream gallery images are full-window visual concepts rather than pure wallpaper files. Skin Studio uses them only as a visual layer behind the real, interactive NextClaw interface; it does not claim to reproduce the mock interface itself. `Arina Hashimoto` and `Gothic Void Crusade` use the upstream preset background files instead of gallery screenshots.

Any image supplied through `--image` remains the user's responsibility. Do not use or redistribute imagery without the necessary rights.
