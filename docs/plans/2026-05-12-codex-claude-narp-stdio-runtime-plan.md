# Codex And Claude NARP Stdio Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Codex and Claude Code appear and run as `narp-stdio` runtime entries instead of OpenClaw-style agent-runtime plugins.

**Architecture:** NextClaw keeps one generic agent runtime integration path: `agents.runtimes.entries.* -> type: "narp-stdio"`. New Codex and Claude Code NARP packages own thin stdio launchers named with `narp`; the launchers reuse a small `narp-stdio` runtime wrapper that exposes an ACP stdio agent around an existing `NcpAgentRuntime`. Existing SDK runtime packages stay unchanged and are consumed as libraries. `acp` remains an internal `wireDialect` detail and must not appear in package or command names.

**Tech Stack:** TypeScript, `@agentclientprotocol/sdk`, existing `@nextclaw/nextclaw-ncp-runtime-stdio-client`, existing Codex SDK runtime package, existing Claude Agent SDK runtime package, Vitest, package-level `tsc`/`lint`/`build`.

---

## Product And Architecture Invariants

- The user-facing and package/command naming says `narp`, not `acp`.
- `wireDialect: "acp"` is allowed only as the internal transport dialect consumed by `narp-stdio`.
- `narp-stdio` remains generic. Do not add Codex or Claude Code branches to `packages/nextclaw-ncp-runtime-stdio-client`.
- `packages/nextclaw-ncp-runtime-stdio-client` is the host-side client only. Do not put agent-side wrapper code or NCP-to-ACP runtime wrapping there.
- The shared agent-side owner, if extracted, must be named and modeled as a wrapper, not as a new agent runtime provider.
- Existing Codex and Claude Code SDK runtime packages are compatibility/library packages. Do not directly modify them for this migration unless a bug in the old library itself blocks reuse.
- New Codex and Claude Code NARP packages may depend on existing SDK runtime classes, but NextClaw core/kernel/service should not import Codex or Claude SDK business logic.
- NextClaw core/kernel/service must not hardcode `codex`, `claude`, package-specific launcher commands, or provider-specific runtime entry creation. Provider identity belongs in runtime entry config, installer/repair flow, marketplace metadata, or the provider wrapper package.
- The final source of truth for runtime selection is `agents.runtimes.entries`, not `registerNcpAgentRuntime`.
- Avoid long-term compatibility bridges. The old Codex/Claude agent-runtime plugin packages should be removed from the runtime registration path once the NARP entries are working.

## Success Criteria

- When configured, `agents.runtimes.entries.codex.type` is `narp-stdio`.
- When configured, `agents.runtimes.entries.claude.type` is `narp-stdio`.
- `nextclaw agents runtimes --json --probe` lists configured `codex` and `claude` entries as ready when their launchers are available.
- A Codex session can stream a real response through `narp-stdio`.
- A Claude Code session can stream a real response through `narp-stdio`.
- The old `nextclaw-ncp-runtime-plugin-codex-sdk` and `nextclaw-ncp-runtime-plugin-claude-code-sdk` paths are not required for the NARP entries to run.
- Tests prove NCP events from the existing SDK runtimes are translated to ACP session updates that `narp-stdio` can translate back to NCP.

## Recommended Package Shape

- Create a runtime-neutral wrapper package:
  - Package: `packages/nextclaw-narp-stdio-runtime-wrapper`
  - Public owner class: `NarpStdioRuntimeWrapper`
  - Responsibility: wrap `NcpAgentRuntime -> ACP AgentSideConnection` for a stdio child process.
- Add new NARP adapter packages instead of editing existing SDK runtime packages:
  - Codex NARP package: `packages/extensions/nextclaw-narp-runtime-codex-sdk`
  - Claude Code NARP package: `packages/extensions/nextclaw-narp-runtime-claude-code-sdk`
- Keep existing packages unchanged in this migration:
  - `packages/extensions/nextclaw-ncp-runtime-codex-sdk`
  - `packages/extensions/nextclaw-ncp-runtime-claude-code-sdk`
  - `packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk`
  - `packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk`
- Add binaries:
  - `nextclaw-codex-narp`
  - `nextclaw-claude-code-narp`
- New packages and command names carry the `narp` contract. Existing SDK runtime packages keep their current names and remain library dependencies during this migration.

## Task 1: Prove The NARP Stdio Runtime Wrapper Boundary

**Files:**
- Create: `packages/nextclaw-narp-stdio-runtime-wrapper/package.json`
- Create: `packages/nextclaw-narp-stdio-runtime-wrapper/tsconfig.json`
- Create: `packages/nextclaw-narp-stdio-runtime-wrapper/module-structure.config.json`
- Create: `packages/nextclaw-narp-stdio-runtime-wrapper/src/index.ts`
- Create: `packages/nextclaw-narp-stdio-runtime-wrapper/src/services/narp-stdio-runtime-wrapper.service.ts`
- Create: `packages/nextclaw-narp-stdio-runtime-wrapper/src/types/narp-stdio-runtime-wrapper.types.ts`
- Test: `packages/nextclaw-narp-stdio-runtime-wrapper/src/services/narp-stdio-runtime-wrapper.service.test.ts`
- Do not modify: `packages/nextclaw-ncp-runtime-stdio-client`

**Steps:**

1. Write wrapper tests with a fake `NcpAgentRuntime` and `@agentclientprotocol/sdk` client-side connection.
2. Verify the wrapper exposes ACP agent methods:
   - `initialize`
   - `newSession`
   - `authenticate`
   - `unstable_setSessionModel`
   - `prompt`
   - `cancel`
3. Verify prompt input mapping:
   - ACP `prompt` text blocks become one NCP user message.
   - `_meta.nextclaw_narp.providerRoute` is preserved as route metadata for the adapter factory.
   - `_meta.nextclaw_narp.sessionMetadata` is preserved as NCP run metadata.
4. Verify NCP event to ACP update mappings:
   - `MessageTextDelta` -> `agent_message_chunk`
   - `MessageReasoningDelta` -> `agent_thought_chunk`
   - `MessageToolCallStart` / args / end / result -> `tool_call` / `tool_call_update`
   - terminal events do not emit user-visible ACP updates
5. Implement the minimal wrapper.
6. Run package-local wrapper tests.
7. Export the wrapper from the new package root only.

## Task 2: Add Codex NARP Stdio Launcher

**Files:**
- Create: `packages/extensions/nextclaw-narp-runtime-codex-sdk/package.json`
- Create: `packages/extensions/nextclaw-narp-runtime-codex-sdk/tsconfig.json`
- Create: `packages/extensions/nextclaw-narp-runtime-codex-sdk/module-structure.config.json`
- Create: `packages/extensions/nextclaw-narp-runtime-codex-sdk/src/index.ts`
- Create: `packages/extensions/nextclaw-narp-runtime-codex-sdk/src/controllers/codex-narp.controller.ts`
- Create: `packages/extensions/nextclaw-narp-runtime-codex-sdk/src/services/codex-narp-runtime-wrapper.service.ts`
- Test: `packages/extensions/nextclaw-narp-runtime-codex-sdk/src/services/codex-narp-runtime-wrapper.service.test.ts`

**Steps:**

1. Write a launcher test using `@agentclientprotocol/sdk` client-side connection against the Codex NARP wrapper.
2. Use a fake `NcpAgentRuntime` or fake Codex runtime factory so the test does not require real OpenAI credentials.
3. Implement only Codex-specific runtime config resolution in the new package. Reuse `@nextclaw/nextclaw-narp-stdio-runtime-wrapper` for ACP agent methods.
4. In `prompt`, read `_meta.nextclaw_narp.providerRoute`, `_meta.nextclaw_narp.sessionMetadata`, and `_meta.nextclaw_narp.tools`.
5. Build the existing `CodexSdkNcpAgentRuntime` config from prompt/session state and environment-backed provider route.
6. Stream NCP events from `runtime.run()` into ACP session updates.
7. Add `bin.nextclaw-codex-narp`.
8. Run:
   - `pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk test`
   - `pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk tsc`
   - `pnpm -C packages/extensions/nextclaw-narp-runtime-codex-sdk build`

## Task 3: Add Claude Code NARP Stdio Launcher

**Files:**
- Create: `packages/extensions/nextclaw-narp-runtime-claude-code-sdk/package.json`
- Create: `packages/extensions/nextclaw-narp-runtime-claude-code-sdk/tsconfig.json`
- Create: `packages/extensions/nextclaw-narp-runtime-claude-code-sdk/module-structure.config.json`
- Create: `packages/extensions/nextclaw-narp-runtime-claude-code-sdk/src/index.ts`
- Create: `packages/extensions/nextclaw-narp-runtime-claude-code-sdk/src/controllers/claude-code-narp.controller.ts`
- Create: `packages/extensions/nextclaw-narp-runtime-claude-code-sdk/src/services/claude-code-narp-runtime-wrapper.service.ts`
- Test: `packages/extensions/nextclaw-narp-runtime-claude-code-sdk/src/services/claude-code-narp-runtime-wrapper.service.test.ts`

**Steps:**

1. Mirror the Codex launcher shape in the new package, but keep Claude-specific runtime-context resolution inside the Claude NARP package.
2. Write tests against a fake runtime factory first.
3. Implement session state for selected model, cancellation, and prompt metadata.
4. Forward provider route and request metadata into the existing Claude runtime config.
5. Add `bin.nextclaw-claude-code-narp`.
6. Run:
   - `pnpm -C packages/extensions/nextclaw-narp-runtime-claude-code-sdk test`
   - `pnpm -C packages/extensions/nextclaw-narp-runtime-claude-code-sdk tsc`
   - `pnpm -C packages/extensions/nextclaw-narp-runtime-claude-code-sdk build`

## Task 4: Configure Runtime Entries Outside Core

**Files:**
- Modify only after launcher tests pass: setup/repair command owner, installer metadata, marketplace metadata, or local smoke config that writes `agents.runtimes.entries`.
- Likely candidates:
  - CLI setup/repair commands, if an existing owner already writes runtime entries.
  - first-party package install metadata or marketplace runtime-entry metadata.

**Steps:**

1. Find the external owner that creates or repairs `agents.runtimes.entries`.
2. Add Codex/Claude entry creation there, not in kernel/core/service runtime resolution and not in plugin loading.
3. Do not add Codex/Claude logic to `narp-stdio` or `resolveAgentRuntimeEntries`.
4. Preserve user overrides.
5. Add tests proving configured entries appear in `listSessionTypes`.

## Task 5: Retire Old Agent-Runtime Plugin Registration Path

**Files:**
- Modify after NARP entries are validated:
  - `packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk`
  - `packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk`
  - root build/lint/tsc scripts if packages are removed
  - marketplace metadata/tests if they advertise old plugin registration

**Steps:**

1. Search for `registerNcpAgentRuntime` references in Codex/Claude plugin packages.
2. Decide whether to delete plugin packages or convert them into migration-only packages.
3. Prefer deletion if no external package contract requires keeping them.
4. Remove root build/lint/tsc references only after package removal.
5. Update tests and marketplace fixtures to point to NARP runtime entries.

## Task 6: End-To-End Validation

**Commands:**

```bash
pnpm -C packages/nextclaw-ncp-runtime-stdio-client test
pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk test
pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk tsc
pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk build
pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk test
pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk tsc
pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk build
pnpm lint:new-code:governance
pnpm check:governance-backlog-ratchet
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs
```

**Smoke:**

Use an isolated `NEXTCLAW_HOME` outside the repository. Configure:

```json
{
  "agents": {
    "runtimes": {
      "entries": {
        "codex": {
          "label": "Codex",
          "type": "narp-stdio",
          "config": {
            "wireDialect": "acp",
            "command": "nextclaw-codex-narp"
          }
        },
        "claude": {
          "label": "Claude Code",
          "type": "narp-stdio",
          "config": {
            "wireDialect": "acp",
            "command": "nextclaw-claude-code-narp"
          }
        }
      }
    }
  }
}
```

Then verify:

```bash
nextclaw agents runtimes --json --probe
pnpm smoke:ncp-chat -- --session-type codex --prompt "Reply exactly OK" --json
pnpm smoke:ncp-chat -- --session-type claude --prompt "Reply exactly OK" --json
```

## Migration Notes

- Existing user configs that set `session_type: "codex"` or `session_type: "claude"` should continue to work because the runtime entry ids remain `codex` and `claude`.
- Existing plugin config values must be mapped to runtime entry config or provider settings before deleting plugin packages.
- If real Codex/Claude credentials are unavailable during development, automated tests should prove the launcher contract with fake runtimes, and final smoke should be marked blocked by credentials rather than silently skipped.
