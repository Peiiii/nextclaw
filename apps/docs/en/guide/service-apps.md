# Service Apps

Service Apps give a NextClaw App a working part behind its Panel. They can save app data, use an approved web service, read a folder that you explicitly share, continue a background task, or offer an Action to a selected Agent.

You use the App from its Panel as usual. Service Apps make the result persist and let the same action be used from the App, an Agent, and the command line when appropriate.

## What you can do

The App author chooses which of these are needed. Before you enable an App, NextClaw shows the requested permissions and configuration state.

| Need | What the App can do | What stays under your control |
| --- | --- | --- |
| Save work | Keep an App's own records, settings, cache, or database | Data belongs to that App instance and can be retained or deleted with the App |
| Use files | Read or update only a folder that you grant | The App cannot browse other folders just because it is installed |
| Connect to a service | Call only the domains declared by the App | A network request outside the declared list is denied |
| Use a token | Use a named secret slot for a service such as GitHub | The token is not shown in the Panel, Action result, or diagnostic record |
| Run in the background | Receive durable Resident events or run a long Job | You can inspect progress, retry a dead-letter event, or ask to cancel a Job |
| Work with an Agent | Let a selected Agent discover and call a declared Action | Agent access is granted per Action and can be revoked |
| Combine Apps | Use a declared Provider or an explicitly configured external resource | Missing or ambiguous dependencies block enablement instead of silently guessing |

Portable Runtime is the Service Apps path for WebAssembly Components. It is designed for Apps whose logic and data handling should be delivered in one portable package across supported desktop platforms. Native-process Service Apps remain available when an App genuinely needs a platform program or a heavy external integration.

## Where to use them

Open **Service Apps** in NextClaw to see installed services, their Actions, state, and requested access. Open an App's Panel to use its day-to-day interface. The first protected call can ask for approval; after approval, the Panel calls the Service through NextClaw rather than directly accessing your system.

For a concrete example, see [GitHub Issue Watcher](/en/guide/service-apps-github-issue-watcher). For step-by-step use, see [Use Service Apps](/en/guide/service-apps-usage).

## Before enabling an App

1. Read the App's description and its requested permissions.
2. If it needs a folder, select only the folder you mean to share and choose read-only access whenever that is enough.
3. If it needs a secret, bind the requested slot to a secret already configured in NextClaw. You do not paste the value into the App manifest or its Panel.
4. If it needs a model, Agent, Provider, or external resource, choose the target you intend to use. NextClaw keeps the App disabled until required setup is complete.
5. Enable the App and use its Panel or approved Actions.

Read [Permissions and data](/en/guide/service-app-permissions-data) before enabling an App that requests files, network access, secrets, or external dependencies.

## When something fails

An App can fail because a permission has not been granted, a required configuration is missing, the requested action is invalid, or the Service itself stopped. NextClaw preserves a code and a short explanation rather than treating all failures as the same error.

Start with [Troubleshoot Service Apps](/en/guide/service-apps-troubleshooting). If an App performs a long operation, inspect its retained Job progress instead of running the action again.

## Related pages

- [Use Service Apps](/en/guide/service-apps-usage)
- [Permissions and data](/en/guide/service-app-permissions-data)
- [GitHub Issue Watcher](/en/guide/service-apps-github-issue-watcher)
- [Portable Runtime for developers](/en/developers/portable-runtime)
