---
name: nextclaw-skin-studio
description: Browse, apply, inspect, customize, switch, or remove lightweight UI skins for a NextClaw instance. Use when the user asks what NextClaw skins are available, wants one of the bundled skins, wants to create a skin from colors or a local image, wants to check the active skin, or wants to restore the default NextClaw appearance.
---

# NextClaw Skin Studio

Use `scripts/skin.mjs` from this skill directory. It owns one unsupported `ui-inject.js` file and does not add a skin system to the NextClaw product core.

## Safety boundary

- Installing this Skill changes nothing by itself. Treat `apply`, `custom`, and `remove` as writes; run them only after the user asks to change the instance.
- Before the first write, state that a skin is same-origin JavaScript with full page access and no official compatibility, security, or reliability guarantee.
- Require a NextClaw build that exposes the experimental `/api/ui-inject.js` hook. If a correct file has no visible effect after refresh, ask the user to update NextClaw; do not patch application bundles.
- Never overwrite or remove a file owned by another tool. The script enforces this boundary.
- All browsers connected to the same NextClaw home use the same active skin. Refresh the page after a change; do not restart NextClaw.

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
   node scripts/skin.mjs apply violet-orbit
   ```

4. Or create a custom skin from a built-in base. Colors must be six-digit hex values; PNG, JPEG, and WebP images must be local and at most 5 MB:

   ```bash
   node scripts/skin.mjs custom --name "My Aurora" --base glass-tide --accent "#22d3ee" --secondary "#a78bfa" --image /absolute/path/hero.png
   ```

5. Run `status` again, then tell the user to refresh the browser or desktop view.

6. Restore the default UI only when requested:

   ```bash
   node scripts/skin.mjs remove
   ```

For an instance using a non-default home, append `--home /absolute/path` to every command. Read [third-party-notices.md](references/third-party-notices.md) when discussing provenance or image rights.

## Built-in skins

- `abyssal-compass`: deep navy, treasure gold, and compass geometry.
- `portal-red`: light red-and-white portal geometry.
- `rose-quartz`: warm translucent rose layers.
- `glass-tide`: light sea-glass waves.
- `violet-orbit`: dark violet and cyan orbital neon.
- `noir-gold`: restrained cinematic black and gold.

`status`, `apply`, `custom`, and `remove` return JSON with `state`, `skinId`, `changed`, and `refreshRequired`. `occupied` means another tool owns the injection and no write is allowed. The released Abyssal Compass predecessor is recognized only for migration or removal.
