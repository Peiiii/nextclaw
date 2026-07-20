# Skin authoring and repair guide

Read this guide completely before creating, refining, or repairing a skin. The goal is not to fill a checklist. The goal is that the user can name **any visible surface** or desired effect and the Agent can change it through a durable, user-owned skin project.

## The personal skin project

Do not edit the installed Skill when making a user's skin. Create a separate directory, preferably under `$NEXTCLAW_HOME/skins/`, so Marketplace updates cannot overwrite the user's work:

```text
$NEXTCLAW_HOME/skins/my-skin/
├── skin.json
├── skin.css
├── skin.js
└── local images, fonts, or other assets
```

Create and apply it from this Skill directory:

```bash
node scripts/skin.mjs create-project "$NEXTCLAW_HOME/skins/my-skin" \
  --name "My Skin" \
  --base jackson-yee

node scripts/skin.mjs apply-project "$NEXTCLAW_HOME/skins/my-skin"
```

- `skin.json` selects a bundled base and optionally overrides tokens, portrait crop, labels, motif, and one local image.
- `skin.css` is arbitrary CSS. It is appended after the shared Skin Studio styles, so it can restyle, hide, move, or replace any page surface.
- `skin.js` is arbitrary JavaScript executed in the NextClaw page. There is no Skin Studio JavaScript API or DSL. Use standard browser APIs directly to query DOM, add elements or SVG, set attributes, install a `MutationObserver`, respond to events, or implement an effect.
- Local project assets are bundled into the generated injection when referenced by `skin.json`; additional assets can be embedded by the Agent in CSS or JavaScript.

**Do not edit the generated `$NEXTCLAW_HOME/ui-inject.js`.** It is disposable output and the next apply replaces it. Edit the personal project and run `apply-project` again.

## Translate intent into an effect

Do not reduce a request to color tokens. Interpret it across the dimensions that matter:

- **layout and geometry**: size, position, spacing, overlap, viewport coverage, card shape, sidebar width, message rhythm, and responsive composition;
- **typography and iconography**: typeface, hierarchy, weight, tracking, icons, custom SVG, labels, and ornamental marks;
- **materials and surfaces**: paper, ink, glass, metal, glow, grain, translucency, borders, shadows, and depth;
- **decorative assets**: portraits, illustrations, textures, masks, pseudo-elements, canvas, SVG, and generated ornaments;
- **motion and micro-interactions**: hover, focus, selection, entrances, progress, streaming, loaders, particles, and reduced-motion behavior.

Examples:

| User intent | Likely implementation |
|---|---|
| “Messages should look like rice paper” | Restyle actual message/Markdown surfaces in `skin.css`; add texture with gradients or a local asset |
| “Make the sidebar a parchment scroll” | Change sidebar geometry and session rows; add ornament layers with CSS or JavaScript |
| “Show tool execution as a timeline” | Use `skin.js` to identify live process rows and add precise project attributes/structure, then style them in `skin.css` |
| “Make the composer a floating jade seal” | Recompose the real composer and its controls without creating a fake input |
| “Turn the loader into a swimming ink dragon” | Insert or replace decorative SVG with `skin.js`, animate it with CSS, and keep reduced-motion behavior |
| “Let the portrait span header and content” | Move the visual canvas to the shared page background and make the real header transparent |

Preserve the real control's behavior and accessibility while changing its presentation. Do not replace a working input, button, menu, or status announcement with a fake screenshot layer.

## Two owner layers

For a personal skin, edit `skin.json`, `skin.css`, and `skin.js`. The installed Skill internals below are relevant only when improving the shared renderer or a bundled skin for everyone:

| Skill source | Shared responsibility |
|---|---|
| `assets/skins.json` | Bundled skin data, pinned images, colors, portrait crop, labels, and motifs |
| `assets/renderer.js` | Shared page discovery, semantic roles, dynamic-node tracking, decorations, and runtime cleanup |
| `assets/foundation-styles.js` | Tokens, typography, whole-page canvas, background continuity, density, and shared surfaces |
| `assets/navigation-styles.js` | Shell, sidebar, navigation, session rows, sidebar actions, and run indicator placement |
| `assets/concept-navigation-styles.js` | Art-directed sidebar hierarchy and grouped navigation for concept-gallery skins |
| `assets/concept-decoration-styles.js` | Page texture, ornamental chrome, particles, plaques, cards, and composer accents for concept-gallery skins |
| `assets/content-styles.js` | Cards, messages, Markdown, code, process rows, composer, and settings sections |
| `assets/control-styles.js` | Header controls, tabs, forms, tables, overlays, feedback, and loading visuals |
| `scripts/skin.mjs` | Project creation, validation, asset assembly, ownership protection, and atomic writes |

Keep shared owners singular. Do not create one renderer or style bundle per bundled skin. A personal effect belongs in the personal project unless it is a real improvement every skin should inherit.

Coverage is only the floor. A bundled reference skin must also preserve the reference's **visual density and authored hierarchy**: section rhythm, icon treatment, ornamental marks, information grouping, signature components, and page-specific composition. A generic token pass that technically touches every surface but leaves the product looking like stock NextClaw is not a faithful skin. Re-express those reference-specific qualities through real NextClaw data and controls; never manufacture fake projects, tasks, messages, or status content just to resemble a concept screenshot.

## Full-product coverage map

The **coverage matrix is not an allowlist**. It is a navigation map for common surfaces. If the user points to something outside it, inspect and change that exact surface too. If no semantic role exists, create one in the personal `skin.js` with the narrowest stable selector or attribute, then style it in `skin.css`; the user does not need to wait for an official role.

| Area | Surfaces to inspect |
|---|---|
| Application canvas | Root, page, shared header/content canvas, portrait layer, reading gradient, scroll end, dock |
| Sidebar and sessions | Brand, new task, search, navigation, groups, session title/preview/time, hover, selected, pin/edit, footer |
| Messages and assistant content | User/assistant messages, avatar, metadata, Markdown, links, quotes, tables, attachments, code, copy/menu, long content |
| Tool and process output | Thinking metadata, tool call/result, status, duration, streaming, expanded content, terminal/code output, success/error |
| Composer and input panel | Text area, placeholder, attachments, skills, model/agent/workspace selectors, send/stop, IME, focus, disabled, loading |
| Marketplace and settings | Search, filters, tabs, collections, cards, settings groups, help text, choices, switches, selects, tables, save/danger actions |
| Overlays and feedback | Dialog, menu, popover, tooltip, command surface, backdrop, toast, alert, confirm, validation message |
| Loading, empty, and error states | Sidebar run indicator, spinner, skeleton, progress, empty action, retry/error, disabled controls |
| Responsive layout | Sidebar collapse, header actions, message/composer width, overlay bounds, art crop, intentional overflow |

For interactive families, inspect `default`, `hover`, `focus-visible`, `active`, `selected`, and `disabled`. Async surfaces also need `loading`, `streaming`, `success`, and `error`. A component is not covered merely because one static frame looks good.

## Feedback-to-code routing

| Feedback | First investigation |
|---|---|
| “The background is too small” or “the header is separate” | Shared page canvas, header transparency, portrait layer bounds, full scroll height |
| “The sidebar has two hover containers” | Which real element owns the session surface; make inner content transparent |
| “The message card still looks default” | Actual user/assistant and Markdown nodes, then all message states |
| “Tool output does not match” | Live process/tool nodes during streaming, success, error, expand/collapse |
| “The input panel looks wrong” | Real composer, input, selectors, attachments, send/stop and focus behavior |
| “The dragon jitters or is too literal” | Actual rendered size, SVG path, transform origin, one complete animation cycle, reduced motion |
| “A menu/dialog/tooltip is still default” | Portal-mounted DOM, open state, focus, selected item, viewport boundary |

Use stable product attributes, ARIA semantics, test IDs, and structural relationships before generated class fragments. Personal JavaScript may observe future DOM changes directly when the surface is mounted lazily.

## Iteration workflow

1. Reproduce the exact URL, viewport, gesture, and surface named by the user. Use representative **real data**, especially for sessions, long messages, tool output, settings, and loading states.
2. Keep one **stable preview** URL throughout the refinement. Do not switch to an empty isolated profile when the user asked to use their local data.
3. Inspect the real DOM, computed styles, geometry, state, and surrounding owner. Capture a before image.
4. Translate the desired result across the five effect dimensions, then edit the personal `skin.css`, `skin.js`, `skin.json`, and local assets as needed. Anything visible is in scope.
5. Run `apply-project` again and refresh. Never hand-edit generated output or the NextClaw application bundle.
6. Check the exact complaint, related states, adjacent shared surfaces, wide/narrow layouts, scrolling, focus, and overflow. Observe cyclic motion for longer than one complete period.
7. Return the stable preview link and say what remains visibly different. Do not call a static screenshot or a passing syntax test proof of effect quality.

## Bundled skin maintenance

When the user explicitly asks to improve the Marketplace Skill itself rather than their personal project:

1. Route per-skin palette, portrait, label, motif, and source corrections to `skins.json`.
2. Route a shared component recipe to its matching `*-styles.js` file.
3. Change `renderer.js` only when shared semantic discovery or lifecycle behavior is wrong.
4. Re-apply the affected bundled skin on a real local instance and inspect every affected surface and state.
5. Keep upstream provenance, rights boundaries, pinned revision, and SHA-256 accurate.

## Security boundary

`skin.js` is intentionally arbitrary same-origin code. It can read page-visible data, alter any DOM, call same-origin endpoints, intercept interactions, or break the UI. It is not sandboxed, reviewed, compatibility-guaranteed, or made safe by Skin Studio. Only apply code the user trusts, make this risk explicit, and use `remove` to restore the default interface if a project fails.
