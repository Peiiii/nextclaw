# nextclaw Web UI — Design Brief for External Redesign

This document gives an AI designer **everything needed to redesign the nextclaw config UI** (visual, layout, and interaction design) **without access to the codebase**. Functionality must stay the same; only the interface may change.

---

## 1. Product context

- **Product name:** nextclaw  
- **Tagline (product):** Personal AI Assistant. (Positioning: “OpenClaw at its best” — lighter, one command, config in browser, no wizard.)  
- **What nextclaw is:** A personal AI assistant you run locally. Users talk to it via CLI or via messaging channels (Telegram, Discord, WhatsApp, Feishu, etc.). The **Web UI is only for configuration** — it does not show chat, history, or monitoring.

**Role of this UI:**  
“Config hub”: configure **default model**, **AI providers** (API keys, base URLs), and **message channels** (enable/disable and set credentials). After saving, the backend applies config; the UI can refresh when the server pushes a config-updated event (WebSocket).

**Out of scope for this UI:**  
No login/auth, no chat interface, no message history, no status/monitoring dashboards.

---

## 2. Users and goals

- **Primary:** Developers / ops and individual users who self-host nextclaw.  
- **Goal:** In the browser, complete setup for model, providers, and channels with minimal steps; get clear save success/failure feedback; optionally see config refresh when the server notifies (WebSocket).

---

## 3. Information architecture and navigation

- **Single app, no separate “pages” in the URL sense.** Navigation is **tab-based** in the main content area, driven by a **sidebar**.  
- **Sidebar (left):**  
  - Brand: logo + “nextclaw”.  
  - Three items: **Models**, **Providers**, **Channels**. Only one is active at a time; the main area shows the corresponding view.  
- **Main content area:** One of three views: Model configuration, Providers list, or Channels list. No global top bar is required (current app does not show a shared header in the main layout; each view has its own title and description).

**Current structure:**

- **Models** (tab id: `model`)  
  → Model configuration view.

- **Providers** (tab id: `providers`)  
  → List of AI providers (cards). Clicking a card or “Configure”/“Add Provider” opens a **Provider edit modal**.

- **Channels** (tab id: `channels`)  
  → List of message channels (cards). Clicking a card or “Configure”/“Enable” opens a **Channel edit modal**.  
  → Feishu has an extra action: “Save & Verify / Connect” in the channel modal.

---

## 4. Page 1 — Models (Model configuration)

**Purpose:** Set the default AI model and show (optionally editable but not persisted) workspace and generation parameters.

**Data shown and editable:**

- **model** (string) — **Persisted.** Default model name, e.g. `minimax/MiniMax-M2.5`.  
- **workspace** (string) — Shown and editable in UI but **not persisted** in this app (backend may have its own default).  
- **maxTokens** (number) — Shown and editable (e.g. slider 1000–32000). **Not persisted** from this UI.  

**Actions:**

- One **Save** (or “Save Changes”) that sends only `{ model }` to the backend.  
- Success: toast “Configuration saved”. Failure: toast “Failed to save configuration: {error}”.

**Layout (current, for reference):**  
Page title “Model Configuration” and short description; then a form with:  
- A “Default Model” block: model name input + short hint (examples).  
- A “Workspace” block: workspace path input.  
- A “Generation Parameters” block: Max Tokens slider.  
- A single submit button at the end.

**Designer freedom:** Grouping, order, visual hierarchy, and layout can change; the above **data and single save action** must remain.

---

## 5. Page 2 — Providers (AI providers list)

**Purpose:** Show all available AI providers; show which are configured (have API key set); open a modal to add or edit a provider.

**Data:**

- **List of providers** comes from backend `GET /api/config/meta` → `meta.providers[]`. Each item: `name`, optional `displayName`, `keywords`, `envKey`, `defaultApiBase`, `supportsWireApi`, `wireApiOptions`, etc.  
- **Configured state** comes from `GET /api/config` → `config.providers[providerName].apiKeySet` (boolean). If true, show as “Ready” (or equivalent); if false, show as “Setup” (or “Add”).

**UI elements:**

- **Tabs (in-page):**  
  - “Configured” (or “Installed”) — count = number of providers with `apiKeySet === true`.  
  - “All Providers” — show all from meta.  
- **Cards:** One card per provider (in the active tab filter).  
  - Logo (optional; backend does not provide logos; frontend can map `name` to a logo asset).  
  - Name: `displayName || name`.  
  - Short description (e.g. openai: “Leading AI models…”; others: “Configure AI services…”).  
  - Status badge: “Ready” (green) if configured, “Setup” if not.  
  - Primary action: “Configure” or “Add Provider” → opens **Provider modal** for that `provider.name`.

**Empty state:** If filtered list is empty, show a short message (e.g. “No providers configured” and “Add an AI provider…”).

**Designer freedom:** Card layout, tabs style, and visual treatment can change; **filter by configured vs all** and **open modal per provider** must remain.

---

## 6. Provider edit modal

**Purpose:** Edit one provider’s API key, API base, optional extra headers, and (if supported) wire API.

**Opened when:** User clicks a provider card or “Configure”/“Add Provider” for a provider. Closed on Save success or Cancel.

**Fields:**

- **apiKey** — Password-style input. If backend says key is already set (`apiKeySet`), show a placeholder like “Leave blank to keep” or “Already set”; only send `apiKey` in the payload if the user entered something.  
- **apiBase** — Text input. Optional; can default to provider’s `defaultApiBase` from meta.  
- **extraHeaders** — Key-value list (add/remove rows). Optional.  
- **wireApi** — Only if `provider.supportsWireApi` is true. Select: `auto` | `chat` | `responses` (labels can be “Auto”, “Chat Completions”, “Responses”).

**Actions:**

- Cancel — close modal without saving.  
- Save — send `PUT /api/config/providers/:provider` with only changed fields (e.g. `apiKey` if filled, `apiBase`, `extraHeaders`, `wireApi`). On success: toast “Configuration saved” and close modal. On failure: toast “Failed to save configuration: {error}”.

**Designer freedom:** Modal size, layout, and grouping of fields can change; **these fields and behaviors** must remain.

---

## 7. Page 3 — Channels (Message channels list)

**Purpose:** Show all message channels; show which are enabled; open a modal to enable/configure a channel.

**Data:**

- **List of channels** from `GET /api/config/meta` → `meta.channels[]`. Each: `name`, optional `displayName`, `enabled` (from server state), optional `tutorialUrl`.  
- **Per-channel config** from `GET /api/config` → `config.channels[channelName]`. If `enabled === true`, show as “Active”; else “Inactive”.

**UI elements:**

- **Tabs (in-page):**  
  - “Enabled” — count = number of channels with `config.channels[c.name].enabled === true`.  
  - “All Channels” — count = total channels.  
- **Cards:** One card per channel (filtered by tab).  
  - Logo/icon (frontend can map `name` to logo; e.g. telegram, discord, feishu, qq, slack, email, dingtalk, mochat, whatsapp).  
  - Name: `displayName || name`.  
  - Short description (e.g. telegram: “Connect with Telegram bots…”; discord: “Connect Discord bots…”; feishu: “Enterprise messaging…”; fallback: “Configure this communication channel”).  
  - Status badge: “Active” (green) if enabled, “Inactive” if not.  
  - Optional: link to `tutorialUrl` (e.g. icon “View Guide” opening in new tab).  
  - Primary action: “Configure” or “Enable” → opens **Channel edit modal** for that `channel.name`.

**Empty state:** If no channels in list, show message like “No channels enabled” and “Enable a messaging channel…”.

**Designer freedom:** Card layout and tabs can change; **filter Enabled vs All** and **open modal per channel** must remain.

---

## 8. Channel edit modal

**Purpose:** Enable/disable a channel and edit its parameters (tokens, IDs, URLs, etc.). Action buttons (including Feishu verify) are driven by config schema actions.

**Opened when:** User clicks a channel card or “Configure”/“Enable”. Closed on Save success or Cancel.

**Fields per channel (must be supported; types and labels below):**

- **telegram:** enabled (boolean), token (password), allowFrom (tags), proxy (text).  
- **discord:** enabled (boolean), token (password), allowFrom (tags), gatewayUrl (text), intents (number).  
- **whatsapp:** enabled (boolean), bridgeUrl (text), allowFrom (tags).  
- **feishu:** enabled (boolean), appId (text), appSecret (password), encryptKey (password), verificationToken (password), allowFrom (tags).  
- **dingtalk:** enabled (boolean), clientId (text), clientSecret (password), allowFrom (tags).  
- **slack:** enabled (boolean), mode (text), webhookPath (text), botToken (password), appToken (password).  
- **email:** enabled (boolean), consentGranted (boolean), imapHost (text), imapPort (number), imapUsername (text), imapPassword (password), fromAddress (email).  
- **mochat:** enabled (boolean), baseUrl (text), clawToken (password), agentUserId (text), allowFrom (tags).  
- **qq:** enabled (boolean), appId (text), secret (password), markdownSupport (boolean), allowFrom (tags).

**Field types:**  
boolean → toggle/switch; password → masked input (optional “show”); text/number/email → normal input; tags → list of strings (add/remove tags).

**Actions:**

- Cancel — close without saving.  
- Save — send `PUT /api/config/channels/:channel` with form data. Success: toast “Configuration saved and applied”; close modal. Failure: toast “Failed to save configuration: {error}”.  
- **Action-driven flow:** render manual actions from `GET /api/config/schema` → `actions[]`; for Feishu verify, use action id `channels.feishu.verifyConnection` and execute via `POST /api/config/actions/:actionId/execute`.

**Designer freedom:** Modal layout, grouping, and order of fields can change; **all listed fields and the Feishu verify action** must remain.

---

## 9. APIs and data (summary)

- **Base URL:** `http://127.0.0.1:18791` (overridable via env for the app).  
- **GET /api/config** — Full config: `agents.defaults` (model, workspace, maxTokens, …), `providers` (per-provider: apiKeySet, apiBase, extraHeaders, wireApi), `channels` (per-channel key-value).  
- **GET /api/config/meta** — Lists: `providers[]` (name, displayName, defaultApiBase, supportsWireApi, …), `channels[]` (name, displayName, enabled, tutorialUrl).  
- **PUT /api/config/model** — Body: `{ model: string }`.  
- **PUT /api/config/providers/:provider** — Body: optional apiKey, apiBase, extraHeaders, wireApi.  
- **PUT /api/config/channels/:channel** — Body: channel-specific key-value (see section 8).  
- **POST /api/config/actions/:actionId/execute** — unified action execution endpoint. Body includes optional `scope` and `draftConfig`.
- **WebSocket** `ws://127.0.0.1:18791/ws` — On event `config.updated`, the app should refetch config (and meta if needed) so the UI reflects server state. Other events (e.g. `connection.open`, `error`) may be used for connection state or logging; **no requirement to show connection status in the UI** in the current spec.

---

## 10. Interaction and feedback

- **Toasts:** Success and error messages for save and (for Feishu) verify. Position and style are flexible (e.g. top-right).  
- **Loading:** When fetching config or meta, show a loading state (e.g. skeletons or spinner) so the user knows data is loading.  
- **Disabled state:** Buttons that trigger save or verify should be disabled while the request is in progress (e.g. “Saving…”).

---

## 11. Design constraints for redesign

- **Functionality:** Do not add or remove features. Same three sections (Models, Providers, Channels), same fields, same APIs, same toasts and loading behavior.  
- **Content:** Same copy and labels (you may keep English + optional Chinese from the current i18n where relevant).  
- **Brand:** Product name “nextclaw”; tagline “Personal AI Assistant”. Logo can be a placeholder or a simple mark if the designer has no asset.  
- **Tech-agnostic:** The redesign can be described in Figma, prose, or wireframes. Implementation will be done in the existing stack (React, Tailwind, design tokens). Providing a clear component/layout structure and states (default, loading, empty, error) helps.

**Current design system (for reference only; can be replaced):**  
- Primary blue (HSL ~217 80% 55%); gray scale; semantic success/warning/destructive; rounded corners (e.g. 2xl for cards); light shadows; system font stack; fast/base/slow transitions. Cards and buttons use primary for active state; status badges use green for “Ready”/“Active” and gray for “Setup”/“Inactive”.

---

## 12. Optional: asset and copy reference

- **Provider logos (optional):** openrouter, aihubmix, anthropic, openai, gemini, deepseek, zhipu, dashscope, moonshot, minimax, vllm, groq (current map: name → filename like openai.svg, minimax.svg).  
- **Channel logos (optional):** telegram, slack, discord, whatsapp, qq, feishu, dingtalk, mochat, email.  
- **Labels:** The app uses short labels for form fields (e.g. “API Key”, “Bot Token”, “Allow From”, “Enabled”). These can stay as-is in the redesign; see `lib/i18n` in codebase for full list if needed during implementation.

---

## 13. Deliverables expected from the designer

- **Visual/layout redesign** of: (1) Shell (sidebar + main area), (2) Models view, (3) Providers list + Provider modal, (4) Channels list + Channel modal.  
- **States:** Default, loading, empty list, and (if desired) save error state.  
- **Responsiveness:** Consider desktop-first (e.g. 1280px+) and optional adaptation for smaller widths.  
- **No code** required; high-fidelity mockups, wireframes, or a clear written design spec with structure and components are enough for the team to implement.

---

*End of design brief. All behavior and data above are authoritative; the designer may change only the visual and interaction design within these constraints.*
