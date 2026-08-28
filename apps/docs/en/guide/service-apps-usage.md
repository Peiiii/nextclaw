# Use Service Apps

This guide explains how to connect a Service App, call its Actions from a Panel, and grant only the required capabilities to a selected Agent.

## Connect and discover Actions

Open **Service Apps**, find the service, and select **Connect and discover actions**. NextClaw starts the corresponding runtime and reads the Actions it actually exposes.

Each Action shows its name and purpose, developer-declared risk, manifest-to-runtime match state, and the Agents that currently have a grant.

A `missing` Action was declared but not exposed by the runtime. An `undeclared` Action was exposed by the runtime but omitted from the manifest. The App developer should correct either mismatch.

## Use an Action from a Panel App

A Panel App must list the Actions it intends to call. On the first real call, NextClaw shows the calling Panel, Action, purpose, risk, and input data.

Choose **Allow** to let that Panel continue with the approved Action, or **Reject** to stop the call. The grant belongs to that Panel and does not automatically extend to another Panel or Agent.

## Let an Agent call an Action

Expand the service in **Service Apps**, use the grant control beside an Action, and select an Agent. The Agent can then discover that Action as a tool.

For an App with “list tasks” and “save task” Actions, you could ask:

> Read my task list, then add a task called “Plan this week.” Tell me the title of the created record when you finish.

An Agent sees only the Actions granted to it. A read grant does not include a write Action. Revoking the grant removes that tool from the Agent.

## Disconnect and reconnect

Use the Service App's additional actions to disconnect its runtime. Connect it again to restart the runtime and rediscover Actions.

If the service enters the Failed state, inspect its last error, check required configuration or external services, and reconnect.

When a WASM Service App call times out or the shared runner exits, NextClaw terminates the failed runner. Persistent Providers and Residents are restored in Provider-first order. The failed call itself is not silently replayed.

## Manage or remove a Service App

- For a Service App installed with a NextClaw App, select **Manage in Apps** to enable, disable, or uninstall the owning App.
- A workspace-source Service App can be removed directly from Service Apps.

Removal can keep managed data or permanently delete both the App and its data after explicit confirmation. See [Service App permissions and data](/en/guide/service-app-permissions-data).

## Troubleshooting

### An Agent cannot see an Action

Make sure the service is connected and that this Action is granted to the current Agent. Panel and Agent grants are separate.

### A Panel's first call failed

Confirm that the Action shown in the grant dialog is declared by the Panel. A rejected grant, disconnected runtime, or Action-discovery mismatch can all stop the call.

### Does closing a Panel delete data?

No. Closing a Panel closes only the interface. Persistence depends on the Service App implementation and the storage permission of its owning App.

### Does background work stop when the Panel closes?

An ordinary Action runs only when called. A Resident Service App can continue receiving host timer events after its Panel closes, until the owning App is disabled or the runtime is disconnected.
