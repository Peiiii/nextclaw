# NextClaw CLI: Capability Map and Complete Command Reference

The `nextclaw` CLI is a first-class way to operate NextClaw. When a product capability can be expressed clearly as a structured operation, NextClaw aims to make it available from the command line so users, developers, scripts, CI jobs, and other Agents can work with the same underlying capabilities.

This does not mean moving every interface into a terminal. Visual, drag-and-drop, and direct-manipulation work can remain GUI-first. The CLI is most useful for runtime management, queries and diagnostics, repeatable operations, automation, and system integration.

Use this page to:

- see what NextClaw can currently do, grouped by capability area; and
- look up the complete CLI surface by command path.

The registered command tree is the source of truth for this page. Adding, removing, or renaming a CLI command requires updating both language versions, and repository tests verify that this reference covers the real command surface.

## How to use this reference

This page lists every executable command path and its primary purpose. To inspect the complete arguments, defaults, and options for one command, run:

```bash
nextclaw <command> --help
```

Use `nextclaw --version` to inspect the installed version. Many query and management commands support `--json`; check the command help before integrating it into a script, CI job, or Agent. For first-time setup, start with [Quickstart](/en/guide/getting-started). For the small set of commands used most often, see [Core Commands](/en/guide/core-commands).

## Feedback and private discussions

No GitHub login is required; see [problem feedback](./feedback). `feedback` names the feedback application. Generic threads, posts, participants, and event subscriptions use `discussion`.

| Command | Purpose |
| --- | --- |
| `nextclaw feedback submit` | Submit a private report and save its receipt |
| `nextclaw feedback list` | List local receipts |
| `nextclaw feedback get` | Read report details and replies |
| `nextclaw feedback reply` | Add reproduction information |
| `nextclaw feedback withdraw` | Withdraw a report |
| `nextclaw feedback link` | Link the current NextClaw account |
| `nextclaw feedback sync` | Sync account reports |
| `nextclaw feedback export` | Export a private receipt |
| `nextclaw feedback import` | Restore a private receipt |
| `nextclaw feedback workflow skill-path` | Locate the packaged feedback workflow skill |
| `nextclaw feedback workflow list` | Read the approved feedback work queue |
| `nextclaw feedback workflow get` | Read a report and its current approval |
| `nextclaw feedback workflow claim` | Claim approved feedback |
| `nextclaw feedback workflow comment` | Write a participant reply |
| `nextclaw feedback workflow result` | Submit verification evidence or a blocker |
| `nextclaw feedback workflow triage` | Classify without granting repair permission |
| `nextclaw feedback workflow recover` | Recover after confirming the previous run stopped |
| `nextclaw feedback workflow authorize-delivery` | Associate an approved repair commit |
| `nextclaw feedback workflow publish` | Verify release proof and update the report |
| `nextclaw discussion skill-path` | Locate the packaged discussion participant skill |
| `nextclaw discussion list` | List accessible threads by space |
| `nextclaw discussion events` | Read events addressed to the current role after a cursor |
| `nextclaw discussion get` | Read a thread and its ordered posts |
| `nextclaw discussion post` | Post as the authenticated participant |
| `nextclaw discussion listen configure` | Save the endpoint, participant credential, and consumer command; the Codex preset can take a workspace |
| `nextclaw discussion listen start` | Start the code-only listener and complete its first scan |
| `nextclaw discussion listen status` | Inspect listener health, heartbeat, and the latest error |
| `nextclaw discussion listen stop` | Stop the current listener instance |
| `nextclaw discussion listen restart` | Restart the listener with its saved configuration |
| `nextclaw discussion listen worker` | Internal listener process entry point |
| `nextclaw discussion listen codex-desktop-trigger` | Internal Codex Desktop consumer preset entry point |
| `nextclaw discussion listen codex-desktop-runner` | Internal asynchronous Codex Desktop task runner |

## Capability map

| Area                         | What you can do                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Setup and account            | Initialize a workspace, sign in, inspect the account, and set a username                      |
| Runtime, status, and logs    | Start and stop the local service and UI, update, diagnose, inspect logs, and view model usage |
| Host management              | Install or remove autostart services on Linux, macOS, and Windows                             |
| Remote access                | Enable, disable, diagnose, and debug remote connections                                       |
| Agents and task execution    | Chat in a terminal, run Headless tasks, and manage Agents and Runtimes                        |
| Projects and sessions        | Create projects, manage work items and artifact links, and organize session bindings          |
| Automation and learning loop | Manage scheduled jobs and learning-loop policy                                                |
| Configuration and secrets    | Read and write configuration, audit secrets, and apply secret references                      |
| MCP and messaging channels   | Manage MCP servers and messaging-channel connections                                          |
| Skills and Marketplace       | Inspect, install, publish, update, and discover Skills                                        |
| NextClaw Apps                | Check, develop, package, publish, install, call, and manage App data                          |

## Setup and account

| Command                         | Purpose                                                           |
| ------------------------------- | ----------------------------------------------------------------- |
| `nextclaw onboard`              | Initialize NextClaw configuration and a workspace                 |
| `nextclaw init`                 | Initialize a workspace; use `--force` to overwrite template files |
| `nextclaw login`                | Sign in to NextClaw Platform and save local credentials           |
| `nextclaw account status`       | Inspect account status and Marketplace publishing readiness       |
| `nextclaw account set-username` | Set the username used for personal Marketplace publishing         |

## Runtime, status, and logs

| Command               | Purpose                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| `nextclaw gateway`    | Start the Gateway in the foreground, optionally with the UI            |
| `nextclaw ui`         | Start the Gateway and UI                                               |
| `nextclaw start`      | Start the Gateway and UI in the background                             |
| `nextclaw restart`    | Restart the background service                                         |
| `nextclaw serve`      | Run the Gateway and UI in the foreground for debugging                 |
| `nextclaw stop`       | Stop the background service                                            |
| `nextclaw status`     | Inspect processes, health, configuration summary, and endpoints        |
| `nextclaw doctor`     | Run diagnostics and optionally repair safe stale state                 |
| `nextclaw logs path`  | Show local log-file paths                                              |
| `nextclaw logs tail`  | Show recent service or crash logs                                      |
| `nextclaw logs query` | Query structured logs by time, level, domain, event, or correlation ID |
| `nextclaw usage`      | Inspect recent model usage, history, and cache statistics              |
| `nextclaw update`     | Check, download, or apply a NextClaw Runtime update                    |

## Host management and autostart

| Command                                   | Purpose                                                    |
| ----------------------------------------- | ---------------------------------------------------------- |
| `nextclaw service install-systemd`        | Install a Linux user-level or system-level systemd service |
| `nextclaw service uninstall-systemd`      | Remove a NextClaw-managed systemd service                  |
| `nextclaw service install-launch-agent`   | Install the macOS LaunchAgent                              |
| `nextclaw service uninstall-launch-agent` | Remove the macOS LaunchAgent                               |
| `nextclaw service install-task`           | Install the Windows Scheduled Task                         |
| `nextclaw service uninstall-task`         | Remove the Windows Scheduled Task                          |
| `nextclaw service autostart status`       | Inspect the host autostart owner and state                 |
| `nextclaw service autostart doctor`       | Diagnose host autostart configuration                      |

## Remote access

| Command                   | Purpose                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `nextclaw remote enable`  | Enable service-managed remote access                               |
| `nextclaw remote disable` | Disable remote access                                              |
| `nextclaw remote status`  | Inspect remote-access and connection state                         |
| `nextclaw remote doctor`  | Run remote-access diagnostics                                      |
| `nextclaw remote connect` | Register the device and keep it connected in foreground debug mode |

## Agents and task execution

| Command                          | Purpose                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `nextclaw agent`                 | Chat in the terminal or send one message with `-m`                                                 |
| `nextclaw exec`                  | Run one Headless task with text, JSON, or JSONL output; see [`nextclaw exec`](/en/developers/exec) |
| `nextclaw agents list`           | List configured Agents                                                                             |
| `nextclaw agents runtimes`       | List and optionally probe available Agent Runtimes                                                 |
| `nextclaw agents runtime config` | Inspect or change configuration for one Runtime                                                    |
| `nextclaw agents new`            | Create an Agent with a name, avatar, home directory, and Runtime                                   |
| `nextclaw agents update`         | Update an existing Agent                                                                           |
| `nextclaw agents remove`         | Remove an Agent                                                                                    |

## Projects and sessions

| Command                                  | Purpose                                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `nextclaw projects list`                 | List registered projects, including projects without sessions                                                  |
| `nextclaw projects templates`            | List built-in project templates                                                                                |
| `nextclaw projects create`               | Create and register a project                                                                                  |
| `nextclaw projects remove`               | Remove a project from the list while preserving its folder, sessions, and work; requires exact ID confirmation |
| `nextclaw projects work list`            | Page through work items by project ID with `--state`, `--cursor`, `--limit`, and `--include-deleted`           |
| `nextclaw projects work get`             | Show work-item details                                                                                         |
| `nextclaw projects work create`          | Create a persistent work item                                                                                  |
| `nextclaw projects work update`          | Update fields, state, or attention                                                                             |
| `nextclaw projects work delete`          | Soft-delete a work item                                                                                        |
| `nextclaw projects work restore`         | Restore a deleted work item                                                                                    |
| `nextclaw projects work activity`        | Show immutable work-item activity                                                                              |
| `nextclaw projects work artifact link`   | Link an artifact file inside the project                                                                       |
| `nextclaw projects work artifact unlink` | Remove an artifact link                                                                                        |
| `nextclaw projects work state list`      | List custom project work states                                                                                |
| `nextclaw projects work state create`    | Create a work state                                                                                            |
| `nextclaw projects work state update`    | Update or reorder a work state                                                                                 |
| `nextclaw projects work state delete`    | Delete a state and optionally migrate existing items                                                           |
| `nextclaw sessions rename`               | Rename a session                                                                                               |
| `nextclaw sessions set-project`          | Bind a session to an existing project directory                                                                |
| `nextclaw sessions clear-project`        | Clear a session's explicit project binding                                                                     |
| `nextclaw sessions delete`               | Permanently delete a session; requires `--confirm <session-id>`                                                |

Every `projects work` command requires `--project <project-id>` and runs through the local NextClaw service.

## Automation and learning loop

| Command                            | Purpose                                                        |
| ---------------------------------- | -------------------------------------------------------------- |
| `nextclaw cron list`               | List scheduled jobs                                            |
| `nextclaw cron add`                | Add a job using an interval, cron expression, or one-time date |
| `nextclaw cron remove`             | Remove a scheduled job                                         |
| `nextclaw cron enable`             | Enable a scheduled job                                         |
| `nextclaw cron disable`            | Disable a scheduled job                                        |
| `nextclaw cron run`                | Run a selected job immediately                                 |
| `nextclaw learning-loop status`    | Inspect learning-loop settings                                 |
| `nextclaw learning-loop enable`    | Enable the learning loop                                       |
| `nextclaw learning-loop disable`   | Disable the learning loop                                      |
| `nextclaw learning-loop threshold` | Set the tool-call threshold for a learning review              |

## Configuration and secrets

### Providers, models and search

These commands require a running NextClaw host and return JSON. Discover templates with `providers templates`, then create a provider with `providers add office --type openai --api-key-env MY_PROVIDER_KEY`. Keys are read from the named environment variable; API keys and custom header values are not printed.

```bash
nextclaw providers models discover office --json
nextclaw providers models set office <provider-scoped-model-id> --json
nextclaw providers test office --model <provider-scoped-model-id> --json
nextclaw models set <provider-scoped-model-id> --json
nextclaw models show --json
nextclaw providers show office --json
```

Discovery returns upstream names. Prefix the selected name with the instance id: `gpt-example` on `office` becomes `office/gpt-example`. Preserve upstream slashes and do not duplicate an existing instance prefix. Discovery does not save models. `providers models set` replaces the entire configured list; omit models to clear it. `providers models configure` replaces all capability overrides: use repeatable `--vision model=true|false`, `--thinking model=off,high`, `--thinking-default model=high`, or `--clear`. Query first and include entries to retain. The default thinking level must occur in the supplied supported levels. Vision=false removes the positive override, rather than forcing built-in vision capability off.

Failed connection tests exit non-zero. Start authorization with `auth start`, follow the returned URI/code, and use `auth poll` at the returned interval; pending is not completion. Writes await the host's apply step. An apply failure needs investigation even if values were saved. Commands do not restart the host.

For search, run `nextclaw search provider exa --api-key-env MY_EXA_KEY`, then `nextclaw search configure --provider exa --enabled-provider exa --max-results 10` and verify with `search show`. Result counts accept 1–50. The enabled list is replaced; `--clear-enabled-providers` disables all. Bocha supports summary/freshness/docs-url; Tavily supports search-depth/include-answer. Other providers reject these specific options. See command help for all flags.

| Command                               | Purpose                                                  |
| ------------------------------------- | -------------------------------------------------------- |
| `nextclaw providers list`             | List provider instances                                  |
| `nextclaw providers templates`        | List templates and authorization methods                 |
| `nextclaw providers show`             | Inspect one provider                                     |
| `nextclaw providers add`              | Add a template or custom provider                        |
| `nextclaw providers update`           | Update name, endpoint, credentials, protocol and headers |
| `nextclaw providers remove`           | Remove a provider and its secret references              |
| `nextclaw providers enable`           | Enable a provider                                        |
| `nextclaw providers disable`          | Disable a provider                                       |
| `nextclaw providers test`             | Test a model connection                                  |
| `nextclaw providers models list`      | Inspect configured models and capabilities               |
| `nextclaw providers models discover`  | Discover models without saving                           |
| `nextclaw providers models set`       | Replace or clear the model list                          |
| `nextclaw providers models configure` | Replace or clear model capability overrides              |
| `nextclaw providers auth start`       | Start provider authorization                             |
| `nextclaw providers auth poll`        | Poll authorization once                                  |
| `nextclaw providers auth import`      | Import supported provider CLI credentials                |
| `nextclaw models list`                | Inspect the runtime model catalog                        |
| `nextclaw models show`                | Inspect the default model                                |
| `nextclaw models set`                 | Set the default model                                    |
| `nextclaw search show`                | Inspect search settings                                  |
| `nextclaw search configure`           | Select default/enabled providers and result count        |
| `nextclaw search provider`            | Configure one search provider                            |

### Generic configuration and secrets

Prefer object-level commands for covered tasks. Generic config commands remain for settings without a dedicated command or explicit manual recovery.

| Command                      | Purpose                                                                     |
| ---------------------------- | --------------------------------------------------------------------------- |
| `nextclaw config get`        | Read a configuration value by dot path                                      |
| `nextclaw config set`        | Write a configuration value by dot path                                     |
| `nextclaw config unset`      | Remove a configuration value                                                |
| `nextclaw secrets audit`     | Audit secret-reference resolution                                           |
| `nextclaw secrets configure` | Configure an env, file, or exec secret provider                             |
| `nextclaw secrets apply`     | Apply secret references and provider configuration in bulk or one at a time |
| `nextclaw secrets reload`    | Tell the running service to reload secrets                                  |

## MCP and messaging channels

| Command                    | Purpose                                       |
| -------------------------- | --------------------------------------------- |
| `nextclaw mcp list`        | List configured MCP servers                   |
| `nextclaw mcp add`         | Add a stdio, HTTP, or SSE MCP server          |
| `nextclaw mcp remove`      | Remove an MCP server                          |
| `nextclaw mcp enable`      | Enable an MCP server                          |
| `nextclaw mcp disable`     | Disable an MCP server                         |
| `nextclaw mcp doctor`      | Check MCP connectivity and tool discovery     |
| `nextclaw channels add`    | Add or update messaging-channel configuration |
| `nextclaw channels list`   | List configured channels                      |
| `nextclaw channels status` | Inspect channel state                         |
| `nextclaw channels login`  | Link a supported channel account by QR code   |

## Skills and Marketplace

| --------------------------------------- | -------------------------------------------- |
| `nextclaw skills installed` | List Skills installed in the current runtime |
| `nextclaw skills info` | Inspect an installed Skill |
| `nextclaw skills install` | Install a Skill from NextClaw Marketplace |
| `nextclaw skills publish` | Create or publish a Marketplace Skill |
| `nextclaw skills update` | Update a published Marketplace Skill |
| `nextclaw marketplace skills search` | Search Marketplace Skills |
| `nextclaw marketplace skills info` | Inspect a Marketplace Skill |
| `nextclaw marketplace skills recommend` | List recommended Skills |
| `nextclaw marketplace skills install` | Install a Marketplace Skill |
| `nextclaw marketplace skills update` | Update a locally installed Marketplace Skill |

## NextClaw Apps

| Command                                    | Purpose                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `nextclaw app create`                      | Create a standalone App; the default template is Rust/WASI                                |
| `nextclaw app doctor`                      | Diagnose the WASI Guest build environment and print repair commands                       |
| `nextclaw app build`                       | Build Rust/WASI Service Components in an App                                              |
| `nextclaw app check`                       | Check a complete App package, Panel, or Service directory                                 |
| `nextclaw app test`                        | Run an App's Action smoke tests in the isolated Runtime                                   |
| `nextclaw app dev`                         | Start the real Runtime from an App package or Service directory                           |
| `nextclaw app pack`                        | Package a `.napp`; pure WASI Apps default to a universal artifact                         |
| `nextclaw app validate-publish`            | Validate an App and its artifacts before Marketplace submission                           |
| `nextclaw app publish`                     | Submit an App to App Marketplace                                                          |
| `nextclaw app call`                        | Call a real Action from an App package or Service directory                               |
| `nextclaw app restart`                     | Restart a Service App running in the NextClaw UI                                          |
| `nextclaw app data list`                   | List active and retained App data instances                                               |
| `nextclaw app data delete`                 | Permanently delete retained App data with an exact App-ID confirmation                    |
| `nextclaw app marketplace search`          | Search Apps in the official App Marketplace                                               |
| `nextclaw app marketplace info`            | Show a Marketplace App and its derived install command                                    |
| `nextclaw app list`                        | List Apps installed in the running NextClaw host                                          |
| `nextclaw app info`                        | Show installed App state and versions                                                     |
| `nextclaw app invoke`                      | Call an Action on an enabled installed App through the running host                       |
| `nextclaw app verification`                | Read redacted runtime verification records from the running host                          |
| `nextclaw app acceptance contract`         | Read the stable Portable Runtime acceptance contract                                      |
| `nextclaw app acceptance status`           | Read current Portable Runtime acceptance status and evidence freshness                    |
| `nextclaw app acceptance export`           | Export the contract, current runtime identity, and acceptance status as JSON              |
| `nextclaw app jobs list`                   | List durable Jobs for one installed App instance                                          |
| `nextclaw app jobs inspect`                | Inspect one durable App Job                                                               |
| `nextclaw app jobs watch`                  | Replay retained Job progress and output after an optional sequence cursor                 |
| `nextclaw app jobs cancel`                 | Request Job cancellation; completion remains pending until runtime confirmation           |
| `nextclaw app resident-inbox list`         | Inspect durable Resident delivery state; `--dead-letters` narrows to recoverable failures |
| `nextclaw app resident-inbox replay`       | Replay one dead-letter Resident event through the host-owned inbox                        |
| `nextclaw app dependencies inspect`        | Inspect external capability/resource dependencies, Provider candidates, and bindings      |
| `nextclaw app dependencies verify`         | Verify whether current dependencies are satisfied                                         |
| `nextclaw app dependencies setup`          | Establish bindings only when a compatible Provider is unique                              |
| `nextclaw app dependencies bind`           | Bind one dependency to an installed trusted Provider                                      |
| `nextclaw app dependencies unbind`         | Remove one dependency binding                                                             |
| `nextclaw app secrets inspect`             | Show declared Secret slots and non-sensitive SecretRef bindings                           |
| `nextclaw app secrets verify`              | Resolve bindings without revealing Secret values                                          |
| `nextclaw app secrets bind`                | Bind one declared Secret slot to an env, file, or exec provider                           |
| `nextclaw app secrets unbind`              | Remove an App SecretRef binding and its active Secret permission                          |
| `nextclaw app permissions inspect`         | Inspect declared directory scopes, grant status, and effective access mode                |
| `nextclaw app permissions document grant`  | Grant or replace a runtime-host directory as read-only or read-write                      |
| `nextclaw app permissions document revoke` | Revoke a directory scope and stop the previous mount                                      |
| `nextclaw app ai-capabilities inspect`     | Inspect declared non-secret model and Agent slots with current bindings                   |
| `nextclaw app ai-capabilities verify`      | Verify required model and Agent slot readiness                                            |
| `nextclaw app ai-capabilities bind`        | Bind one declared model or Agent slot to a configured target                              |
| `nextclaw app ai-capabilities unbind`      | Remove one model or Agent slot binding                                                    |
| `nextclaw app operations`                  | List durable App lifecycle operations                                                     |
| `nextclaw app install`                     | Install a Marketplace App, local directory, or `.napp` bundle through the running host    |
| `nextclaw app enable`                      | Enable an installed App                                                                   |
| `nextclaw app disable`                     | Disable an installed App                                                                  |
| `nextclaw app update`                      | Start a background App update                                                             |
| `nextclaw app rollback`                    | Roll back to an installed version                                                         |
| `nextclaw app uninstall`                   | Start an uninstall; purging data requires exact App-ID confirmation                       |

See [Service Apps](/en/guide/service-apps) for the user workflow and [Develop a WASM Service App](/en/developers/portable-service-apps) for runtime development commands.

`app dev` and `app call` accept a schema v2 App root directly. A package with one Service is selected automatically; use `--component <service-id>` when a package has multiple Services. Local `.napp` files can be installed by relative path, for example `nextclaw app install ./my-app.napp`.

`app invoke <app-id> <action-name> --input '<json>'` calls an Action on an enabled installed App, rather than a source package. It returns the call ID, trace ID, data version, and verification-record ID. Use `app verification [--acceptance <id>] [--app <id>] [--limit <n>]` to inspect the corresponding redacted, persisted runtime facts; add `--json` for machine-readable output.

`app acceptance contract|status|export` reads the single Portable Runtime acceptance registry used by the product, server, CLI, and release gate. `status` evaluates evidence against the active product version, runtime version, runner fingerprint, and contract fingerprint; only `current-passed` means the evidence is current. `export` always writes the complete machine-readable status document. Use `--locale en` for English presentation and `--app <id>` only when inspecting a non-default acceptance App.

For Apps that declare Secret slots, use `app secrets inspect <app-id>` to see required configuration without revealing values. Bind a declared slot with `app secrets bind <app-id> --slot <slot> --source env|file|exec --id <secret-id> [--provider <provider>]`, then run `app secrets verify <app-id>`. A required unbound or unresolved slot leaves the App in `needs-configuration` and blocks enable with a `SECRET_*` error code. `app secrets unbind` removes the active Secret permission; retaining App data never retains Secret bindings.

Installing an App never grants its declared directory scopes automatically. Use `app permissions inspect <app-id>` to inspect them, `app permissions document grant <app-id> --scope <scope-id> --path <directory> --mode read|read-write` to grant or replace a runtime-host directory, and `app permissions document revoke <app-id> --scope <scope-id>` to revoke it. The effective mode cannot exceed the App's declaration, and every grant change immediately retires the previous runtime mount.

## Automation guidance

- When a query or management command supports `--json`, scripts and Agents should prefer the machine-readable output.
- For non-interactive tasks, use `nextclaw exec --format text|json|jsonl` and interpret the documented exit codes.
- Before changing configuration, secrets, host services, or permanently deleting data, inspect the command's `--help` output and permission boundary.
- The CLI, UI, and built-in AI tools should call the same product owner. If the same capability behaves differently across entry points, please report it.

## Related documentation

- [Core Commands](/en/guide/core-commands)
- [`nextclaw exec` Headless execution](/en/developers/exec)
- [Runtime and hosting](/en/guide/runtime-hosting)
- [Configuration](/en/guide/configuration)
- [Troubleshooting](/en/guide/troubleshooting)
- [Security and permissions](/en/guide/security-and-permissions)

## Resource protocol

| Command | Description |
| --- | --- |
| `nextclaw resources list` | Discover registered categories and objects from the running service; supports --type, --query and --limit; JSON output |
| `nextclaw resources resolve` | Resolve a real object URI into an immutable asset snapshot reference without executing its content |
