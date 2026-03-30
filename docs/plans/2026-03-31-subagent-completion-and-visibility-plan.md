# Subagent Completion And Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the broken subagent completion path in NCP chat so completion results reliably persist into the originating session, then evolve subagents into visible NCP-native task objects instead of hidden legacy system-message callbacks.

**Architecture:** Treat the current problem as a runtime-boundary bug first, not a pure frontend refresh bug. The implementation should remove NCP subagent completion's dependency on the legacy `AgentLoop`/`MessageBus` relay, persist structured subagent lifecycle data directly into the current NCP session, publish structured session realtime events, and render a visible task card in the chat UI. Legacy runtime pieces should only remain where they still own real entrypoints such as CLI, gateway inbound channels, cron, and plugin bridge traffic.

**Tech Stack:** TypeScript, `@nextclaw/core`, `@nextclaw/ncp`, `@nextclaw/ncp-agent-runtime`, `@nextclaw/ncp-toolkit`, React, React Query, websocket realtime events, Vitest.

---

## Context And Judgement

This plan is based on three confirmed facts:

1. The current NCP subagent completion experience is broken beyond simple UI refresh.
   - User observation: after subagent completion, the UI shows no follow-up.
   - User verification: even after a full page refresh, the originating session history still lacks the completion result.
   - Therefore the bug is not only "`session.updated` is ignored by the frontend"; the completion output is not reliably persisted into the current NCP session.

2. The current completion path crosses the wrong runtime boundary.
   - `SubagentManager` currently publishes a legacy `system` inbound message onto `MessageBus`.
   - `GatewayAgentRuntimePool` / `AgentLoop` then attempt to wake a separate legacy agent runtime and synthesize a follow-up assistant reply.
   - NCP chat, however, already has its own native backend/runtime/session model, so this bridge is structurally fragile and mismatched.

3. `AgentLoop` is not globally deletable today, but the NCP dependency on it should be removed.
   - Keep for now: CLI `nextclaw agent`, gateway inbound channel handling, cron, plugin bridge/direct runtime use.
   - Delete or retire for NCP path: subagent completion's reliance on legacy system-message relay, plus any NCP-only bridge glue that exists solely to wake `AgentLoop`.

## Target Outcome

After implementation:

- A subagent spawned from an NCP chat session produces a visible task object in that same session.
- When the subagent completes or fails, the originating NCP session gets durable persisted updates without depending on a legacy `system` message bounce.
- The chat UI shows a visible subagent task card with status transitions such as `running`, `completed`, `failed`, `cancelled`.
- Session realtime sync uses structured `session.summary.upsert` and/or session message persistence semantics, not a vague "maybe refresh now" hint.
- NCP no longer depends on `AgentLoop` for subagent completion.
- Legacy runtime modules remain only where they still own real product entrypoints.

## Runtime Chain Inventory

This section is the deletion boundary for this plan.

### A. Frontend NCP Chat Mainline

Current chain:

```text
NcpChatPage
  -> /api/ncp/agent
  -> createUiNcpAgent
  -> DefaultNcpAgentBackend
  -> DefaultNcpAgentRuntime
  -> NextclawNcpContextBuilder
  -> NextclawNcpToolRegistry
```

Judgement:

- This is already the real product mainline for the web chat UI.
- It should not bounce sideways into `GatewayAgentRuntimePool`, `AgentLoop`, or legacy `MessageBus` for subagent completion.
- Any NCP subagent completion branch that still depends on legacy wakeup is in-scope for deletion.

### B. Legacy Gateway Inbound Mainline

Current chain:

```text
Channel inbound / service gateway
  -> MessageBus
  -> GatewayAgentRuntimePool.run()
  -> NativeAgentEngine
  -> AgentLoop
```

Judgement:

- This is still a real non-NCP entrypoint.
- Do not delete this entire path in this plan unless a separate migration moves channel/gateway traffic to NCP.

### C. CLI Agent Mainline

Current chain:

```text
nextclaw agent / nextclaw agent -m
  -> AgentLoop.processDirect()
```

Judgement:

- This is still real and documented user-facing behavior.
- Do not delete it in this plan.

### D. Cron / Heartbeat / Plugin Direct Bridge

Current chain:

```text
cron
  -> GatewayAgentRuntimePool.processDirect()

heartbeat
  -> GatewayAgentRuntimePool.processDirect()

plugin runtime bridge
  -> GatewayAgentRuntimePool.processDirect()
```

Judgement:

- These are still real non-NCP entrypoints.
- Do not delete them in this plan.
- They become deletion candidates only after those entrypoints are migrated to an NCP-native orchestration path.

## Deletion Contract For This Iteration

Must delete:

- NCP subagent completion's dependency on legacy `MessageBus.publishInbound(systemMessage)`
- NCP subagent completion's dependency on `GatewayAgentRuntimePool.run()`
- NCP subagent completion's dependency on `AgentLoop.processSystemMessage()`
- any NCP-only bridge glue whose only purpose is "wake legacy runtime so the current NCP session can see completion"

Should delete if replacement lands cleanly:

- transitional `session.updated` UI event producers/consumers that become redundant after `session.summary.upsert` or direct message persistence is authoritative

Must not delete in this iteration:

- `AgentLoop` wholesale
- `NativeAgentEngine` wholesale
- `GatewayAgentRuntimePool` wholesale
- CLI `nextclaw agent` path
- gateway inbound channel processing
- cron / heartbeat / plugin direct runtime bridges

Reason:

- Those are not "already replaced but forgotten" branches.
- They are still live product entrypoints today.
- The specific thing that is already replaced, and therefore must be deleted, is the NCP subagent completion bounce back into the legacy runtime.

## Non-Goals

- Do not delete `AgentLoop`, `NativeAgentEngine`, or `GatewayAgentRuntimePool` in this iteration unless a callsite audit proves they are unused. Current codebase evidence shows they still back CLI/gateway/cron/plugin flows.
- Do not introduce a second hidden fallback path "just in case". The result should be one primary completion path for NCP sessions.
- Do not implement a separate subagent side panel in this iteration. The first visible UX should be an inline task card in the main conversation.

### Task 1: Lock The Bug With End-To-End Failing Tests

**Files:**
- Create: `packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.subagent-completion.test.ts`
- Modify: `packages/nextclaw/src/cli/commands/service-gateway-startup.test.ts`
- Test: `packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.subagent-completion.test.ts`

**Step 1: Write the failing NCP integration test**

Cover this exact flow:

- start `createUiNcpAgent(...)`
- open a native NCP session
- stub the provider so the assistant calls `spawn`
- make the spawned subagent finish deterministically
- assert the originating NCP session now contains:
  - the original assistant tool call
  - a persisted follow-up message or service event representing completion
  - an updated session summary

Suggested skeleton:

```ts
it("persists subagent completion back into the originating ncp session", async () => {
  const bus = new MessageBus();
  const sessionManager = new SessionManager(workspace);
  const providerManager = createStubProviderManager({
    mainResponses: [
      createToolCallResponse("spawn", { task: "check 1+1" }),
      createTextResponse("subagent finished: 1+1=2"),
    ],
    subagentResponses: [
      createTextResponse("1+1=2"),
    ],
  });

  const agent = await createUiNcpAgent({
    bus,
    providerManager,
    sessionManager,
    getConfig: () => createConfig(workspace),
  });

  const runEvents = await collectRunEvents(agent, {
    sessionId: "session-subagent-native",
    text: "spawn a subagent to verify 1+1=2",
  });

  const messages = await agent.sessionApi.listSessionMessages("session-subagent-native");
  expect(runEvents.some((event) => event.type === NcpEventType.RunFinished)).toBe(true);
  expect(messages.some(hasVisibleSubagentCompletion)).toBe(true);
});
```

**Step 2: Add a negative assertion for the current broken path**

Assert the test fails if completion only emits a legacy `system` bus message without writing back into the NCP session store.

**Step 3: Add a realtime contract test**

Extend service/UI test coverage so the completion path must publish a structured realtime session change, preferably `session.summary.upsert`, not only `session.updated`.

**Step 4: Run targeted tests to confirm failure before code changes**

Run:

```bash
pnpm -C packages/nextclaw exec vitest run \
  src/cli/commands/ncp/create-ui-ncp-agent.subagent-completion.test.ts \
  src/cli/commands/service-gateway-startup.test.ts
```

Expected: FAIL because completion does not currently persist back into the NCP session.

### Task 2: Remove NCP Subagent Completion's Dependency On Legacy System-Message Relay

**Files:**
- Modify: `packages/nextclaw-core/src/agent/subagent.ts`
- Modify: `packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-tool-registry.ts`
- Modify: `packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.ts`
- Modify: `packages/ncp-packages/nextclaw-ncp-agent-runtime/src/runtime.ts`
- Modify: `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-backend.ts`

**Step 1: Introduce a structured subagent lifecycle sink**

Refactor `SubagentManager` so completion does not always hardcode:

- `MessageBus.publishInbound(systemMessage)`

Instead add an injected sink contract, for example:

```ts
type SubagentLifecycleSink = {
  onRunStarted?: (event: SubagentRunStartedEvent) => Promise<void>;
  onRunUpdated?: (event: SubagentRunUpdatedEvent) => Promise<void>;
  onRunCompleted?: (event: SubagentRunCompletedEvent) => Promise<void>;
  onRunFailed?: (event: SubagentRunFailedEvent) => Promise<void>;
};
```

`SubagentManager` should:

- keep run bookkeeping internally
- emit structured lifecycle events through the sink
- only use the legacy `system` bus relay in a dedicated compatibility adapter, not as the default hardcoded behavior

**Step 2: Add an NCP-native sink for current session persistence**

In the NCP path, the sink should write completion back into the originating NCP session state/store directly.

Preferred behavior:

- store a service-side message or extension part that represents the subagent task state
- keep `runId`, `label`, `status`, timestamps, and summary/result in metadata
- ensure this state lands in `NextclawAgentSessionStore`/NCP session persistence

This can be represented as:

```ts
{
  role: "service",
  parts: [
    {
      type: "extension",
      extensionType: "nextclaw.subagent.run",
      data: {
        runId,
        label,
        status,
        task,
        resultSummary,
        startedAt,
        finishedAt,
      }
    }
  ]
}
```

**Step 3: Stop relying on a second legacy agent turn for NCP completion**

For NCP sessions, the subagent completion should not require:

- `MessageBus` inbound relay
- `GatewayAgentRuntimePool.run()`
- `AgentLoop.processSystemMessage()`
- a second assistant synthesis turn just to paraphrase the result

If a user-facing summary is still desired, generate it inside the NCP-native path and persist it directly into the same session.

**Step 4: Keep a compatibility adapter only for non-NCP legacy callers**

If CLI/gateway legacy callers still require system-message wakeups, isolate that in a named adapter, for example:

```ts
createLegacySubagentSystemRelay({ bus })
```

That makes the remaining legacy dependency explicit and removable later.

### Task 3: Converge Realtime Semantics On Structured Session Updates

**Files:**
- Modify: `packages/nextclaw/src/cli/commands/ncp/ncp-session-realtime-change.ts`
- Modify: `packages/nextclaw/src/cli/commands/service-ncp-session-realtime-bridge.ts`
- Modify: `packages/nextclaw/src/cli/commands/service-gateway-startup.ts`
- Modify: `packages/nextclaw-ui/src/hooks/use-realtime-query-bridge.ts`
- Modify: `packages/nextclaw-ui/src/api/ncp-session-query-cache.ts`

**Step 1: Make NCP completion publish structured session summary updates**

For NCP-originated subagent changes, publish `session.summary.upsert` after persistence succeeds.

This should be the primary frontend sync contract.

**Step 2: Treat `session.updated` as transitional only**

Short-term:

- frontend may still respond to `session.updated` by invalidating the active session and list queries

Long-term:

- once all producers emit structured summary updates or direct message stream updates, remove `session.updated`

**Step 3: Patch the current frontend gap immediately**

Even before the old event is removed, add:

```ts
if (event.type === "session.updated") {
  queryClient?.invalidateQueries({ queryKey: ["ncp-sessions"] });
  queryClient?.invalidateQueries({ queryKey: ["ncp-session-messages", event.payload.sessionKey] });
  return;
}
```

This is not the full fix, but it closes the confirmed frontend blind spot while the main persistence refactor lands.

**Step 4: Add tests for realtime convergence**

Test that:

- completion emits `session.summary.upsert`
- the active thread refetches/updates
- a full refresh still shows the same completion state because it was actually persisted

### Task 4: Render A Visible Inline Subagent Task Card In Chat

**Files:**
- Modify: `packages/nextclaw-ui/src/components/chat/ncp/ncp-session-adapter.ts`
- Modify: `packages/nextclaw-ui/src/components/chat/adapters/chat-message.adapter.ts`
- Modify: `packages/nextclaw-agent-chat-ui/src/components/chat/view-models/chat-ui.types.ts`
- Modify: `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message.tsx`
- Create: `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/subagent-run-card.tsx`
- Test: `packages/nextclaw-ui/src/components/chat/adapters/chat-message.adapter.test.ts`
- Test: `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`

**Step 1: Add a first-class UI part for subagent runs**

Do not overload this as a generic tool card forever.

Introduce a dedicated view model, for example:

```ts
type SubagentRunPartViewModel = {
  type: "subagent-run";
  runId: string;
  label: string;
  status: "running" | "completed" | "failed" | "cancelled";
  summary?: string;
  startedAt?: string;
  finishedAt?: string;
};
```

**Step 2: Map NCP extension/service messages into this view model**

`ncp-session-adapter.ts` should recognize:

- `role: "service"`
- `extensionType: "nextclaw.subagent.run"`

and convert them into `subagent-run` UI parts.

**Step 3: Render the inline task card**

The first iteration should show:

- label
- live status
- short summary/result
- timestamps

It should feel like a task/progress object, not like another assistant paragraph.

**Step 4: Keep the UX intentionally narrow**

First version:

- inline card in the current conversation only
- no separate side panel
- no resume screen
- no manual steering buttons yet

That keeps the change minimal while still aligning with the "visible subagent" model.

### Task 5: Audit Legacy Runtime Pieces And Delete The Replaced NCP Bridge Pieces

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/prd/current-feature-list.md`
- Modify: `docs/prd/current-feature-overview.md`
- Optional delete/modify after audit:
  - `packages/nextclaw/src/cli/commands/service-gateway-startup.ts`
  - `packages/nextclaw/src/cli/commands/agent-runtime-pool.ts`
  - `packages/nextclaw-core/src/agent/loop.ts`
  - `packages/nextclaw-core/src/engine/native.ts`

**Step 1: Record the audit result explicitly**

Expected conclusion today:

- `AgentLoop`: keep for now as a non-NCP runtime owner
- `NativeAgentEngine`: keep for now as a non-NCP runtime owner
- `GatewayAgentRuntimePool`: keep for now as a non-NCP runtime owner
- NCP subagent completion's legacy relay bridge: must delete or retire in this plan
- `session.updated` websocket event: transitional, candidate for deletion after convergence

**Step 2: Delete only NCP-specific obsolete bridge code in this iteration**

Required deletion targets:

- any NCP-only bridge branch that exists solely to wake legacy `AgentLoop`
- any completion-specific wiring that becomes unused once NCP writes completion directly
- any subagent completion code path that publishes legacy `system` inbound messages only so the current NCP session can observe completion

**Step 3: Do not perform speculative platform-wide deletion**

Before removing `AgentLoop` entirely in a future plan, prove replacement coverage for:

- `nextclaw agent -m`
- interactive CLI `nextclaw agent`
- gateway inbound channel traffic
- cron direct execution
- plugin runtime direct bridge

If any of these still depend on `AgentLoop`, the correct move is to document the boundary and postpone deletion.

### Task 6: Validate End-To-End Behavior

**Files:**
- Test: `packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.subagent-completion.test.ts`
- Test: `packages/nextclaw-ui/src/components/chat/adapters/chat-message.adapter.test.ts`
- Test: `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`

**Step 1: Run targeted backend tests**

Run:

```bash
pnpm -C packages/nextclaw exec vitest run \
  src/cli/commands/ncp/create-ui-ncp-agent.subagent-completion.test.ts \
  src/cli/commands/ncp/ui-session-service.test.ts \
  src/cli/commands/ncp/ncp-session-realtime-change.test.ts \
  src/cli/commands/service-gateway-startup.test.ts
```

Expected: PASS

**Step 2: Run targeted frontend tests**

Run:

```bash
pnpm -C packages/nextclaw-ui exec vitest run \
  src/components/chat/adapters/chat-message.adapter.test.ts

pnpm -C packages/nextclaw-agent-chat-ui exec vitest run \
  src/components/chat/ui/chat-message-list/chat-message-list.test.tsx
```

Expected: PASS

**Step 3: Run typecheck/lint for touched packages**

Run:

```bash
pnpm -C packages/nextclaw tsc
pnpm -C packages/nextclaw lint
pnpm -C packages/nextclaw-ui tsc
pnpm -C packages/nextclaw-agent-chat-ui tsc
```

**Step 4: Run maintainability guard**

Run:

```bash
pnpm lint:maintainability:guard
```

**Step 5: Manual smoke**

Use a real NCP native chat session and verify:

1. Ask the agent to spawn a subagent.
2. Observe an inline visible subagent task card in the same conversation.
3. Wait for completion.
4. Confirm the card transitions to completed and a result summary is shown.
5. Refresh the page.
6. Confirm the task state and completion summary are still present in history.

## Recommended Implementation Order

1. Lock the failing persistence test first.
2. Remove NCP completion's dependency on legacy `system` relay.
3. Converge realtime updates on structured session changes.
4. Add visible subagent task card rendering.
5. Audit and delete only the now-unused NCP bridge pieces.

## References

- Existing NCP native cutover plan:
  - [2026-03-18-ncp-native-runtime-refactor-plan.md](./2026-03-18-ncp-native-runtime-refactor-plan.md)
- Current broken bridge symptom area:
  - [subagent.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/subagent.ts)
  - [agent-runtime-pool.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/agent-runtime-pool.ts)
  - [use-realtime-query-bridge.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/hooks/use-realtime-query-bridge.ts)
