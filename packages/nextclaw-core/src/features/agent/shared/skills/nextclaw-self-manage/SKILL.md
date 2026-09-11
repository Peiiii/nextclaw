---
name: nextclaw-self-manage
description: Self-manage NextClaw runtime via CLI guide. For install/start/status/doctor/service/channels/config/agents/projects/sessions/apps and App data/cron/remote/update operations, discovering local HTTP/API/webhook addresses, submitting feedback issues, querying personal feedback, and diagnosing a NextClaw Desktop background exit, crash, restart, or suspected external termination.
description_zh: 通过 NextClaw CLI 管理 NextClaw 自身，覆盖安装、启动、状态、诊断、服务、渠道、配置、Agent、项目、会话、应用及应用数据、定时任务、远程访问、更新、本地 HTTP/API/webhook 地址发现、提交反馈问题、查询个人反馈，以及 Windows Desktop 后台退出、崩溃、重启或疑似外部终止的自助排查。
metadata: { "nextclaw": { "always": true, "emoji": "🛠️" } }
---

# NextClaw Self-Management

Use this skill whenever the user asks to manage NextClaw itself (version, service status, diagnostics, channels, config, agents, projects, sessions, apps and App data, cron, remote, update, installed skills, marketplace skills, local HTTP/API/webhook addresses), report a NextClaw problem, or follow up on a reported problem.

## Source of Truth

Always use the built-in NextClaw self-management guide as the operation guide.

1. Read the built-in guide path provided by the system prompt first.
2. If the packaged guide is unavailable in a repo source checkout, use repo docs path `docs/USAGE.md`.
3. Never treat workspace `USAGE.md` snapshots or copied artifacts as the source of truth.
4. If both guide paths are unavailable, use `nextclaw --help` and `nextclaw <subcommand> --help` as fallback and tell the user that guide file is missing.

## Routing Rules

- Treat NextClaw self-management as a product-management intent, not a generic "create/install/publish" intent.
- Read the built-in self-management guide before opening unrelated generic skills.
- Example: "create a new Agent" maps to NextClaw agent management, not `skill-creator`.

## Stable Execution Rules

- Map CLI/runtime version lookup to `nextclaw --version`. When the question is about the process currently serving NextClaw, use `nextclaw status --json` and read `runtime.version`; do not substitute the CLI version, launcher version, or bundle pointer.
- Treat `nextclaw update --channel beta` as opting into both preview and production candidates; the updater offers whichever compatible version is newer. The `stable` channel remains production-only.
- For an explicitly authorized self-update, run `nextclaw update` through the ordinary exec/CLI path. If its result requires a restart, then run `nextclaw restart`; never look for or invent an agent-only update tool.
- Prefer machine-readable output: use `--json` when available.
- Before calling local HTTP APIs or `/webhook`, run `nextclaw status --json` and read `endpoints.uiUrl` / `endpoints.apiUrl`; do not guess the service port.
- For webhook payload details, read the focused guide linked from the self-management guide only when you need to implement or debug a webhook caller.
- Execute only commands documented in the self-management guide or CLI help; do not invent commands or config paths.
- When the user asks to report a NextClaw problem, use the guide's private feedback commands yourself, without sending the user to a form. Submit only relevant, redacted reproduction details; never require GitHub login. Keep receipt keys private, reuse saved request IDs after uncertain submission, and query the original report for replies. A released fix does not authorize upgrading the user's environment.
- When the user asks about their reports, use feedback list/get/reply yourself and explain actual maintainer replies. Do not create an AI polling job by default. Distinguish ready from published; report query failures honestly and never infer resolution from silence. Suggest submitting a report when a relevant bug is observed, but obtain the user's intent to submit before sending diagnostic details.
- Prefer object-level CLI commands for configuration management. For providers/models/search, use `nextclaw providers ...`, `nextclaw models ...`, and `nextclaw search ...`; do not read/edit config files or substitute generic `config set/unset` or gateway config actions for these covered tasks.
- Generic config commands and gateway config tools remain transitional options only for documented capabilities not covered by object-level CLI or explicit manual recovery. A missing running host is not a reason to silently edit files instead.
- Read API keys from a named environment variable with `--api-key-env`; never print the variable or copy credentials into a command argument. Query saved settings with the relevant `show` command, and verify provider connectivity with `providers test`. An API apply failure is not success even if values were saved.
- Provider model discovery does not save models. `providers models set` replaces the full list; `providers models configure` replaces all capability overrides. Query existing settings first and include entries the user intends to keep.
- For provider authorization, follow the URI/code from `providers auth start`, poll the returned session id at the advertised interval, and treat only `authorized` as completion. `providers auth import` is available for supported external CLI credentials.
- In desktop-installed runtimes, still use the same `nextclaw ...` commands. The desktop launcher provides a managed command surface to AI command tools; do not ask the user to install the NPM CLI just to run self-management commands.
- Keep installed skills and marketplace catalog as two different domains:
  - local installed: `nextclaw skills installed|info`
  - marketplace catalog and installed marketplace lifecycle: `nextclaw marketplace skills search|info|recommend|install|update`
- After mutating operations, close the loop with:
  - `nextclaw status --json`
  - and `nextclaw doctor --json` when needed
- Be explicit about restart semantics after changes. When the user has authorized a required restart, invoke `nextclaw restart` directly. The active connection can briefly disconnect; the controlled-restart handoff continues eligible interrupted sessions after the replacement host is ready. If the running host is unavailable or predates recovery support, use an external-terminal restart and disclose that automatic continuation is unavailable for that transition.
- `nextclaw gateway` starts a foreground gateway. It has no `start`, `status`, `restart`, or `stop` subcommands.
- After modifying a running Service App, run `nextclaw app restart <app-id> --json` before validating through the live product UI or panel-to-service action calls.
- Treat App code and managed App data as separate lifecycles. Uninstall/removal keeps managed data by default; delete it only when the user explicitly chooses the destructive data-removal option.
- For App data discovery, run `nextclaw app data list --json` against the running host. Treat the returned `id`, `appId`, `lifecycle`, usage breakdown, and instance path as authoritative.
- Independently delete only an entry whose latest list result says `lifecycle: retained` and `actions.deleteRetainedData: true`. Use `nextclaw app data delete <data-id> --confirm <app-id> --json`, where the data id comes from that list result and the confirmation exactly matches its `appId`.
- Never synthesize App data ids, delete an active entry through the retained-data command, or substitute direct recursive filesystem deletion for the managed API. After deletion, run `nextclaw app data list --json` again and verify the exact entry is absent.
- Reset a Service App development instance only when explicitly requested, using `nextclaw app dev <service-app-dir> --reset-data --confirm <app-id> --json`; the confirmation must match the manifest id.
- App data removal never authorizes deletion of documents or directories separately granted to the App outside its managed instance.
- For channel discovery before messaging, use `nextclaw channels list --json` and treat returned `channels[].id` values as authoritative.
- For cron notifications, do not add delivery flags to the cron command. Put the notification intent in the scheduled message and let the scheduled agent call the `message` tool with an explicit channel and recipient.
- For Agent creation/update/removal, treat `nextclaw agents list|new|update|remove --json` as the default path and follow the Agent management section in the self-management guide.
- For runtime context injection, use `nextclaw agents runtime config <runtime-id> --json` to inspect and `--inject-nextclaw-context <true|false>` to update. Apply the authorized restart using the lifecycle guidance above.
- Automatic continuation requires a supported managed/foreground host or NextClaw systemd service and plain `nextclaw restart`, without port/open/timeout overrides. Desktop/other-supervisor exits and legacy stop/start transitions do not carry this handoff. If the restart request times out, inspect status before retrying; an interrupted tool result is not proof that the restart failed.
- For project creation, discovery, or removal, use `nextclaw projects list|templates|create|remove --json`; project removal also requires `--confirm <project-id>` and preserves the local folder, sessions, and Project Work. Do not synthesize placeholder sessions or edit the project registry file directly.
- For session naming, project binding, or deletion, use `nextclaw sessions rename|set-project|clear-project|delete --json`; deletion also requires `--confirm <session-id>`. Do not edit session journal metadata directly.
- Do not edit `config.json` or `agents.list` directly for normal Agent CRUD; only do that when the user explicitly wants a manual recovery path.
- When creating an Agent, prefer an explicit non-text avatar and avoid text-based styles such as DiceBear `initials`.

## Minimal Self-Management Flow

1. Understand user intent and map to one concrete CLI action.
2. Read the relevant section in the self-management guide.
3. Execute the documented command with safe parameters.
4. Verify with status/doctor.
5. Report outcome + next action (if any).

## Release Notes / Changelog Lookup

When user asks "what changed in version X", follow:

- `references/release-notes-changelog.md`
- Do not claim details without a traceable source path.

## Runtime Incident Diagnosis

When the user reports missing messages, missing replies, intermittent failures, extension exits, config apply failures, automation failures, a Desktop window/background suddenly disappearing, a crash, restart, or suspected external termination, follow:

- `references/runtime-diagnostics.md`
- Collect status and structured log evidence before proposing a code change.
- Keep proven facts, stage-level inference, and insufficient evidence separate.

## High-frequency Intents

- CLI/runtime selected for this command: `nextclaw --version`
- Runtime currently serving the local API: `nextclaw status --json` → `runtime.version`
- Service health: `nextclaw status --json` / `nextclaw doctor --json`
- Runtime incident logs: `nextclaw logs query --since 2h --json` and narrow by `--domain` / `--correlation-id`
- Local HTTP/API/webhook addresses: `nextclaw status --json` and read `endpoints.uiUrl` / `endpoints.apiUrl`
- Lifecycle: `nextclaw start|restart|stop`
- Service App live runtime: `nextclaw app restart <app-id> --json`
- Mini App platform artifact: `nextclaw app pack <mini-app-dir> --target <target-key> --out <target-key>.napp --json`
- Mini App publish validation/submission: `nextclaw app validate-publish|publish <mini-app-dir> [--artifacts <dir>] --json`
- App data inventory: `nextclaw app data list --json`
- Retained App data deletion: `nextclaw app data delete <data-id> --confirm <app-id> --json`
- Service App development data reset: `nextclaw app dev <service-app-dir> --reset-data --confirm <app-id> --json`
- Channels: `nextclaw channels list --json|status|login`
- Providers: `nextclaw providers list|templates|show|add|update|remove|enable|disable|test`, plus `providers models list|discover|set|configure` and `providers auth start|poll|import`
- Models: `nextclaw models list|show|set`
- Search: `nextclaw search show|configure|provider`
- Uncovered configuration or explicit recovery only: `nextclaw config get|set|unset`
- Agents: `nextclaw agents list|runtimes|runtime config|new|update|remove`
- Projects: `nextclaw projects list|templates|create|remove`
- Sessions: `nextclaw sessions rename|set-project|clear-project|delete`
- Automation: `nextclaw cron list|add|remove|enable|run`
- Installed skills: `nextclaw skills installed|info`
- Marketplace skills: `nextclaw marketplace skills search|info|recommend|install|update`
