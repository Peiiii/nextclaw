# Panel Apps

A Panel App is a lightweight local application that runs in NextClaw's right side. Dashboards, forms, calculators, data browsers, and temporary workbenches can remain interactive instead of ending as a screenshot or static response.

![A Panel App running beside a session](/product-screenshots/nextclaw-panel-app-running-en.png)

## When to use one

- A data report needs filters and metric switching.
- A repeated calculation belongs in a form or calculator.
- Local files need a small persistent browser.
- Generated HTML should stay usable beside the task.

## Create a Panel App

Describe the purpose, data, and interactions:

<div class="nc-task-prompt">
  <p>Turn the current sales analysis into a local Panel App. Add month and product-line filters, and show revenue, margin, and a trend chart. Read the existing analysis-output data without modifying the source CSV files.</p>
</div>

The agent can create a `.panel.html` file or a manifest-backed app and open it for review. Verify the real data, interactions, and narrow-screen layout before keeping it.

## App list and references

Manage existing Panel Apps from the app list and reference one from the session composer when asking for changes.

![The NextClaw Panel Apps list](/product-screenshots/nextclaw-panel-apps-page-en.png)

Use a Panel App's More Actions menu to open it on its own. NextClaw Desktop opens the app in your default browser, while the web app opens it in a new tab. The standalone page only shows the app, but it remains connected to the current NextClaw instance, so existing approvals, Service Actions, and agent calls keep working. A local standalone page stops working when its NextClaw instance stops.

## Service Apps

When a Panel App needs a local runtime or controlled action, pair it with a Service App. Review every exposed action and permission, and grant only what the app needs.

The Service Apps page lists every Service Action. Use the grant control beside an action to select an agent; that agent can then discover and call the same action as a tool. Grants can be revoked at any time, and ungranted agents do not see the tool.

See [Service Apps](/en/guide/service-apps) to connect a Service, approve a Panel call, or grant an Action to an Agent.

## App data and uninstall

NextClaw keeps installable code separate from mutable App data. Updates replace code while preserving the managed App instance. Uninstalling an App or removing a workspace Service App also keeps that instance by default, so a later reinstall can continue with the same data.

The removal dialog offers two explicit choices:

- **Keep data** removes the App and keeps its managed instance.
- **Delete app and data** removes both after destructive confirmation.

Before confirming, NextClaw shows the exact managed path and storage used by data, config, state, cache, temporary files, and logs. Retained instances remain visible in the Apps page and can be deleted separately later. Files or folders that you granted to an App outside its managed instance are never deleted by either flow.

For CLI inspection and cleanup, use the running NextClaw host:

```bash
nextclaw app data list --json
nextclaw app data delete <data-id> --confirm <app-id> --json
```

The delete command accepts only retained data. Copy the opaque data id from the latest list output and confirm the exact App id; do not delete the storage directory manually.

Related: [Service Apps](/en/guide/service-apps)
