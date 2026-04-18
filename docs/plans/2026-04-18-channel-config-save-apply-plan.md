# Channel Config Save Apply Implementation Plan

## Execution Status

- Status: Completed on 2026-04-18
- Outcome: Implemented the full plan with targeted tests, type checks, and maintainability review.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make channel config saves return fast, stop coupling `channels.*` changes to plugin registry reload, and show explicit frontend save/apply lifecycle for channel settings.

**Architecture:** Split channel config persistence from runtime apply. The server route persists config and publishes `config.updated` immediately, then schedules channel apply in the background and emits explicit channel-apply status events. The runtime hot-reload plan stops treating `channels.*` as a plugin-registry rebuild trigger, while Feishu tool registration shifts from “configured-at-load-time only” to “always register, fail clearly at execution time if not configured” so tool visibility no longer depends on plugin reload timing.

**Tech Stack:** TypeScript, Hono UI server routes, React + TanStack Query, Zustand, Vitest, existing WebSocket realtime event bridge.

---

### Task 1: Freeze the target contract in tests

**Files:**
- Modify: `packages/nextclaw-core/src/config/reload.test.ts`
- Modify: `packages/nextclaw-server/src/ui/router.weixin-channel-config.test.ts`
- Modify: `packages/nextclaw-ui/src/components/config/ChannelForm.test.tsx`

**Step 1: Add failing reload-plan assertions**

- Change the channel-config reload test so `channels.feishu.enabled` still restarts channels, but no longer sets `reloadPlugins`.
- Keep `reloadAgent` expectations only if the final implementation still requires it.

**Step 2: Add failing route assertions for async apply**

- Update the Weixin channel config route test to assert:
  - config is saved immediately
  - `config.updated` is published immediately
  - channel apply status events are published
  - route no longer blocks on synchronous apply completion semantics

**Step 3: Add failing frontend assertions**

- Extend `ChannelForm.test.tsx` so it can assert:
  - save success shows “saved / applying” semantics instead of “saved and applied”
  - channel apply failure/success state is rendered from realtime events

**Step 4: Run the smallest failing test set**

Run:

```bash
pnpm -C packages/nextclaw-core exec vitest run src/config/reload.test.ts
pnpm -C packages/nextclaw-server exec vitest run src/ui/router.weixin-channel-config.test.ts
pnpm -C packages/nextclaw-ui exec vitest run src/components/config/ChannelForm.test.tsx
```

Expected: channel reload-plan test fails first, then route/UI tests fail until implementation lands.

### Task 2: Remove channel-save coupling to plugin registry reload

**Files:**
- Modify: `packages/nextclaw-core/src/config/reload.ts`
- Modify: `packages/nextclaw-core/src/config/reload.test.ts`

**Step 1: Narrow the reload plan**

- Change `buildReloadPlan()` so `channels.*` only drives channel restart and any still-needed runtime refresh.
- Remove the `reloadPlugins` side effect from channel config changes.

**Step 2: Keep the rule explicit**

- Replace the old comment with a direct explanation that channel config changes are channel-runtime concerns, not plugin-registry rebuild triggers.

**Step 3: Re-run the targeted reload-plan test**

Run:

```bash
pnpm -C packages/nextclaw-core exec vitest run src/config/reload.test.ts
```

Expected: all reload-plan assertions pass.

### Task 3: Make Feishu tool registration runtime-stable

**Files:**
- Modify: `packages/extensions/nextclaw-channel-plugin-feishu/src/tool-account.ts`
- Modify: `packages/extensions/nextclaw-channel-plugin-feishu/src/calendar.ts`
- Modify: `packages/extensions/nextclaw-channel-plugin-feishu/src/task.ts`
- Modify: `packages/extensions/nextclaw-channel-plugin-feishu/src/chat.ts`
- Modify: `packages/extensions/nextclaw-channel-plugin-feishu/src/docx.ts`
- Modify: `packages/extensions/nextclaw-channel-plugin-feishu/src/drive.ts`
- Modify: `packages/extensions/nextclaw-channel-plugin-feishu/src/identity.ts`
- Modify: `packages/extensions/nextclaw-channel-plugin-feishu/src/oauth.ts`
- Modify: `packages/extensions/nextclaw-channel-plugin-feishu/src/perm.ts`
- Modify: `packages/extensions/nextclaw-channel-plugin-feishu/src/sheets.ts`
- Modify: `packages/extensions/nextclaw-channel-plugin-feishu/src/wiki.ts`
- Modify: `packages/extensions/nextclaw-channel-plugin-feishu/src/bitable.ts`

**Step 1: Add one shared registration helper**

- Introduce a helper that decides which Feishu tool families should register based on config shape, not on “currently has configured enabled accounts”.

**Step 2: Remove registration-time account gating**

- Update each Feishu tool registration entry so it no longer early-returns only because no configured account is present.
- Preserve explicit per-tool disable switches.

**Step 3: Keep execution failures explicit**

- Ensure execution still fails with a clear “Feishu credentials/account not configured” message when the user invokes an unconfigured tool.

**Step 4: Run focused Feishu tool tests**

Run:

```bash
pnpm -C packages/nextclaw-ui exec vitest run --root /Users/peiwang/Projects/nextbot/packages/extensions/nextclaw-channel-plugin-feishu src/chat.test.ts src/docx.test.ts src/tool-account-routing.test.ts
```

Expected: registrations remain stable and account-routing behavior still passes.

### Task 4: Split channel save from channel apply on the server

**Files:**
- Modify: `packages/nextclaw-server/src/ui/types.ts`
- Modify: `packages/nextclaw-server/src/ui/ui-routes/config.controller.ts`
- Modify: `packages/nextclaw-server/src/ui/router.weixin-channel-config.test.ts`

**Step 1: Add explicit channel apply events**

- Extend `UiServerEvent` with a channel config apply status event, carrying channel id, lifecycle state, and optional error message.

**Step 2: Queue channel apply in the background**

- Change the channel config route to:
  - save config
  - publish `config.updated`
  - schedule background apply
  - return the updated channel payload immediately

**Step 3: Serialize per-channel apply jobs**

- Prevent overlapping save clicks from causing concurrent apply runs for the same channel.
- Later saves should queue behind the current run instead of racing.

**Step 4: Publish apply lifecycle**

- Emit started / succeeded / failed events around the background apply task.

**Step 5: Re-run the route test**

Run:

```bash
pnpm -C packages/nextclaw-server exec vitest run src/ui/router.weixin-channel-config.test.ts
```

Expected: route returns fast semantics while still eventually applying in background.

### Task 5: Teach the frontend the difference between “saved” and “applied”

**Files:**
- Modify: `packages/nextclaw-ui/src/api/types.ts`
- Modify: `packages/nextclaw-ui/src/hooks/useConfig.ts`
- Modify: `packages/nextclaw-ui/src/components/config/ChannelForm.tsx`
- Modify: `packages/nextclaw-ui/src/components/config/ChannelForm.test.tsx`
- Modify: `packages/nextclaw-ui/src/lib/i18n.ts`

**Step 1: Extend realtime event typing**

- Add the new channel apply event to frontend websocket event types.

**Step 2: Update channel save toast semantics**

- Change channel save success messaging from “saved and applied” to “saved / applying”.

**Step 3: Render apply state in the form**

- Subscribe `ChannelForm` to realtime channel apply events for the active channel.
- Show a small status line/badge for:
  - applying
  - applied
  - apply failed

**Step 4: Keep form interaction predictable**

- Save button only blocks on the HTTP save request.
- Once the request returns, the form is usable again even if apply is still running.

**Step 5: Re-run the frontend test**

Run:

```bash
pnpm -C packages/nextclaw-ui exec vitest run src/components/config/ChannelForm.test.tsx
```

Expected: channel form reflects saved/applying/applied/failed states correctly.

### Task 6: Validate the whole chain and record delivery

**Files:**
- Modify: `docs/logs/<decide-at-finish>/README.md`

**Step 1: Run targeted validation**

Run:

```bash
pnpm -C packages/nextclaw-core exec vitest run src/config/reload.test.ts
pnpm -C packages/nextclaw-server exec vitest run src/ui/router.weixin-channel-config.test.ts
pnpm -C packages/nextclaw-ui exec vitest run src/components/config/ChannelForm.test.tsx
pnpm -C packages/nextclaw-ui exec vitest run --root /Users/peiwang/Projects/nextbot/packages/extensions/nextclaw-channel-plugin-feishu src/chat.test.ts src/docx.test.ts src/tool-account-routing.test.ts
pnpm lint:maintainability:guard
pnpm check:governance-backlog-ratchet
```

**Step 2: Run one integration-level sanity check**

- If a lightweight local route smoke is available, exercise one real channel save path and verify:
  - save returns quickly
  - apply event is emitted
  - no plugin registry reload is triggered for `channels.*`

**Step 3: Run independent maintainability review**

- Perform one pass using `post-edit-maintainability-review` guidance and summarize whether the final shape reduced coupling and hidden reload complexity.

**Step 4: Update iteration record**

- At finish, decide whether to merge into the latest related log or create a new `docs/logs/v<semver>-<slug>/README.md`.
- Record implementation, validation, release impact, user acceptance, maintainability summary, and npm publish status.
