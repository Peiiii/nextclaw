# Inspect task results

A NextClaw task can deliver more than a chat reply. It may produce explanations, files, source code, Markdown, charts, HTML pages, images, or a Panel App.

## Where results appear

### Session content

Use the conversation for conclusions, status, and questions that need your decision. Important claims should point to a file, source, or concrete number.

### Session workspace

The right workspace exposes project files, open files, subtasks, and scheduled jobs related to the session. Generated files should also exist in the agreed output directory.

### File previews

Open Markdown, code, HTML, documents, spreadsheets, and presentations without leaving the task. HTML can be inspected as source or rendered output, and code changes can be reviewed as diffs.

![An HTML data report open beside its NextClaw session](/product-screenshots/nextclaw-workspace-preview-en.png)

### Inbox deliveries

Scheduled work, background Agents, and long-running monitors can deliver Markdown or static HTML reports to the inbox. HTML is displayed in isolation without running scripts or loading remote resources. Closing the reader keeps the item unread, and you can start a linked conversation when the result needs follow-up work.

![A daily AI and technology briefing created by a background Agent and displayed in the inbox reader](/product-screenshots/nextclaw-ai-delivery-html-en.png)

The inbox prioritizes unread deliveries when any exist, then falls back to the full history instead of showing an empty list. From the same page, you can change filters, continue the conversation, archive a delivery, or delete it.

![Viewing and managing AI-delivered reports in the NextClaw inbox](/product-screenshots/nextclaw-inbox-page-en.png)

### Panel Apps

Dashboards, forms, calculators, and interactive pages can remain available as Panel Apps instead of becoming a static screenshot.

## Review checklist

1. **Goal:** does the deliverable answer the original request?
2. **Inputs:** were the right files, links, and date ranges used?
3. **Actions:** did it avoid unintended overwrites, deletions, sends, or external requests?
4. **Output:** do files open, numbers reconcile, and pages work?
5. **Boundaries:** are sources, limitations, and uncertainty visible?

## Refine the result

Name the existing object and the requested change:

```text
Keep the processed data. Replace the first page with an executive summary and add the data refresh time.
```

Review the actual final file after the change. Do not treat a textual success message as proof that the artifact is correct.

Related: [Background results and proactive delivery](/en/guide/background-results) · [Visualize results](/en/guide/visualizations) · [Panel Apps](/en/guide/panel-apps)

Next: [choose how to reuse the work](/en/guide/after-setup).
