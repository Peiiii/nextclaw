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

## Service Apps

When a Panel App needs a local runtime or controlled action, pair it with a Service App. Review every exposed action and permission, and grant only what the app needs.
