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

## Capability map

| Area                         | What you can do                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Setup and account            | Initialize a workspace, sign in, inspect the account, and set a username                      |
| Runtime, status, and logs    | Start and stop the local service and UI, update, diagnose, inspect logs, and view model usage |
| Host management              | Install or remove autostart services on Linux, macOS, and Windows                             |
| Remote access                | Enable, disable, diagnose, and debug remote connections                                       |
| Agents and task execution    | Chat in a terminal, run Headless tasks, and manage Agents and Runtimes                        |
| Projects and sessions        | Create projects, inspect templates, and organize session bindings                             |
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

| Command                           | Purpose                                                         |
| --------------------------------- | --------------------------------------------------------------- |
| `nextclaw projects list`          | List registered projects, including projects without sessions   |
| `nextclaw projects templates`     | List built-in project templates                                 |
| `nextclaw projects create`        | Create and register a project                                   |
| `nextclaw sessions rename`        | Rename a session                                                |
| `nextclaw sessions set-project`   | Bind a session to an existing project directory                 |
| `nextclaw sessions clear-project` | Clear a session's explicit project binding                      |
| `nextclaw sessions delete`        | Permanently delete a session; requires `--confirm <session-id>` |

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

| Command                                 | Purpose                                      |
| --------------------------------------- | -------------------------------------------- |
| `nextclaw skills installed`             | List Skills installed in the current runtime |
| `nextclaw skills info`                  | Inspect an installed Skill                   |
| `nextclaw skills install`               | Install a Skill from NextClaw Marketplace    |
| `nextclaw skills publish`               | Create or publish a Marketplace Skill        |
| `nextclaw skills update`                | Update a published Marketplace Skill         |
| `nextclaw marketplace skills search`    | Search Marketplace Skills                    |
| `nextclaw marketplace skills info`      | Inspect a Marketplace Skill                  |
| `nextclaw marketplace skills recommend` | List recommended Skills                      |
| `nextclaw marketplace skills install`   | Install a Marketplace Skill                  |
| `nextclaw marketplace skills update`    | Update a locally installed Marketplace Skill |

## NextClaw Apps

| Command                           | Purpose                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `nextclaw app create`             | Create a standalone App; the default template is Rust/WASI                             |
| `nextclaw app doctor`             | Diagnose the WASI Guest build environment and print repair commands                    |
| `nextclaw app build`              | Build Rust/WASI Service Components in an App                                           |
| `nextclaw app check`              | Check a complete App package, Panel, or Service directory                              |
| `nextclaw app test`               | Run an App's Action smoke tests in the isolated Runtime                                |
| `nextclaw app dev`                | Start the real Runtime from an App package or Service directory                        |
| `nextclaw app pack`               | Package a `.napp`; pure WASI Apps default to a universal artifact                      |
| `nextclaw app validate-publish`   | Validate an App and its artifacts before Marketplace submission                        |
| `nextclaw app publish`            | Submit an App to App Marketplace                                                       |
| `nextclaw app call`               | Call a real Action from an App package or Service directory                            |
| `nextclaw app restart`            | Restart a Service App running in the NextClaw UI                                       |
| `nextclaw app data list`          | List active and retained App data instances                                            |
| `nextclaw app data delete`        | Permanently delete retained App data with an exact App-ID confirmation                 |
| `nextclaw app marketplace search` | Search Apps in the official App Marketplace                                            |
| `nextclaw app marketplace info`   | Show a Marketplace App and its derived install command                                 |
| `nextclaw app list`               | List Apps installed in the running NextClaw host                                       |
| `nextclaw app info`               | Show installed App state and versions                                                  |
| `nextclaw app operations`         | List durable App lifecycle operations                                                  |
| `nextclaw app install`            | Install a Marketplace App, local directory, or `.napp` bundle through the running host |
| `nextclaw app enable`             | Enable an installed App                                                                |
| `nextclaw app disable`            | Disable an installed App                                                               |
| `nextclaw app update`             | Start a background App update                                                          |
| `nextclaw app rollback`           | Roll back to an installed version                                                      |
| `nextclaw app uninstall`          | Start an uninstall; purging data requires exact App-ID confirmation                    |

See [Service Apps](/en/guide/service-apps) for the user workflow and [Develop a WASM Service App](/en/developers/portable-service-apps) for runtime development commands.

`app dev` and `app call` accept a schema v2 App root directly. A package with one Service is selected automatically; use `--component <service-id>` when a package has multiple Services. Local `.napp` files can be installed by relative path, for example `nextclaw app install ./my-app.napp`.

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
