---
name: nextclaw-skin-studio
description: Use when a user wants to browse, apply, inspect, create, refine, switch, or remove a NextClaw skin; wants a personal skin with arbitrary CSS, JavaScript, images, SVG, DOM changes, motion, or component-level effects; asks for 易烊千玺/Jackson Yee, 桥本有菜, 迪丽热巴, 初音未来, KUN, Jinx, ENFP, or Gothic Void Crusade; or says a skin looks wrong or incomplete anywhere in the product.
---

# NextClaw Skin Studio

Use `scripts/skin.mjs` from this skill directory. It owns one unsupported `ui-inject.js` file and does not add a skin system to the NextClaw product core.

The shared renderer is an external design-system runtime, not a wallpaper switcher. It applies tokens, semantic surfaces, component states, page-aware recipes, and independent decorations across the app shell, real conversations, skill marketplace, settings, forms, overlays, code blocks, process rows, and loading states.

When the request is to create, refine, review, or repair a skin, **you must read [skin-authoring-and-repair-guide.md](references/skin-authoring-and-repair-guide.md) completely before editing**. It explains the user-owned project, unrestricted effect boundary, source ownership, real-data preview, and visual iteration method. Do not infer those rules from this overview.

## Safety boundary

- Installing this Skill changes nothing by itself. Treat `apply`, `custom`, `apply-project`, and `remove` as instance writes; run them only after the user asks to change the instance. `create-project` writes only the explicitly selected project directory.
- Before the first write, state that a skin is same-origin JavaScript with full page access and no official compatibility, security, or reliability guarantee.
- Require a NextClaw build that exposes the experimental `/api/ui-inject.js` hook. If a correct file has no visible effect after refresh, ask the user to update NextClaw; do not patch application bundles.
- Never overwrite or remove a file owned by another tool. The script enforces this boundary.
- Applying an included skin downloads one pinned image from the upstream Codex Dream Skin repository, verifies its SHA-256 digest, and embeds it into `ui-inject.js`. It never downloads or executes remote JavaScript. A missing download or digest mismatch is a hard failure; do not substitute another image.
- A personal project's `skin.js` is arbitrary, unsandboxed, same-origin JavaScript with full page access. Skin Studio exposes no JavaScript API and does not make this code safe. Inspect the project source, explain the risk, and apply only code the user trusts.
- Several upstream gallery entries depict public figures or protected characters. Before applying one, say that the upstream image is third-party material, is not covered by the upstream MIT software license, and remains the user's responsibility. Do not imply endorsement by the depicted person or rights holder.
- All browsers connected to the same NextClaw home use the same active skin. Refresh the page after a change; do not restart NextClaw.
- When the user asks to preview local real data, use the real NextClaw home and isolate only the development process run state. Do not copy a small subset of sessions into a temporary home and present it as a real-data preview.

## Workflow

1. Show the built-in catalog when the user has not selected a skin:

   ```bash
   node scripts/skin.mjs list
   ```

2. Inspect the target instance without changing it:

   ```bash
   node scripts/skin.mjs status
   ```

3. Apply the selected built-in skin:

   ```bash
   node scripts/skin.mjs apply jackson-yee
   ```

4. For a small token/image variant, create a one-off custom skin. Colors must be six-digit hex values; PNG, JPEG, and WebP images must be local and at most 5 MB:

   ```bash
   node scripts/skin.mjs custom --name "My Aurora" --base gothic-void-crusade --accent "#22d3ee" --secondary "#a78bfa" --image /absolute/path/hero.png
   ```

5. For an authored or repeatedly refined skin, create a durable personal project outside the installed Skill, preferably under `$NEXTCLAW_HOME/skins/`:

   ```bash
   node scripts/skin.mjs create-project "$NEXTCLAW_HOME/skins/my-skin" --name "My Skin" --base jackson-yee
   ```

   Edit its `skin.json`, arbitrary `skin.css`, arbitrary `skin.js`, and local assets. There is no project JavaScript API or component allowlist. Apply the project with:

   ```bash
   node scripts/skin.mjs apply-project "$NEXTCLAW_HOME/skins/my-skin"
   ```

6. Run `status` again, then tell the user to refresh the browser or desktop view.

7. Restore the default UI only when requested:

   ```bash
   node scripts/skin.mjs remove
   ```

## Authoring and repair workflow

- Treat feedback such as “the message card is wrong”, “the sidebar hover has two layers”, “tool output is still default”, or “the input panel does not match” as a request to repair the exact real surface, not as a request for a new wallpaper.
- Keep one stable preview URL and use representative real data. Inspect the actual surface, then freely change the personal project's CSS, JavaScript, DOM decoration, SVG, imagery, layout, or motion as the effect requires.
- Re-run `apply-project` for the same project after each source edit. Never patch generated `$NEXTCLAW_HOME/ui-inject.js`, the installed Skill, or an application bundle for a personal refinement.
- Verify the reported effect in the real interaction, related states, wide/narrow layouts, scrolling, focus, and at least one complete motion cycle before saying the repair is complete.

For an instance using a non-default home, append `--home /absolute/path` to every command. If the upstream repository is already cloned or network access is unavailable, append `--source-dir /absolute/path/to/Codex-Dream-Skin`; the same pinned SHA-256 checks still apply. Read [third-party-notices.md](references/third-party-notices.md) when discussing provenance or image rights.

## Built-in skins

- `jackson-yee`: 易烊千玺 / Jackson Yee light portrait concept.
- `arina-hashimoto`: 桥本有菜 / Arina Hashimoto rose portrait preset.
- `dilraba-violet`: 迪丽热巴 / Dilraba violet portrait concept.
- `miku-cyan`: Hatsune Miku cyan-and-pink character concept.
- `kun-noir`: KUN black-and-gold stage portrait concept.
- `jinx-pop`: Jinx pink-and-blue comic character concept.
- `enfp-spark`: bright ENFP illustrated character concept.
- `people-ai-red`: red-and-white People AI concept.
- `god-of-wealth`: cream, red, and gold God of Wealth concept.
- `pink-custom`: the upstream pink customization concept.
- `gothic-void-crusade`: the upstream Gothic Void Crusade background preset.

`concept-preview` entries come from the upstream gallery's full-window visual concepts, while `preset-background` entries are upstream pure backgrounds. Skin Studio extracts the source image's palette, material, portrait crop, and decorative language, then applies them to real interactive NextClaw components. It does not display the concept screenshot's fake controls or text as a background UI.

`status`, `apply`, `custom`, `apply-project`, and `remove` report the resulting state as JSON. `occupied` means another tool owns the injection and no write is allowed. The released Abyssal Compass predecessor is recognized only for migration or removal.
