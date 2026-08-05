# Background results and proactive delivery

You do not need to remain in one conversation while work finishes. NextClaw returns background results through either a lightweight notification or the inbox, depending on whether the result needs to persist.

## Two ways results reach you

### Conversation completion notifications

When an AI reply finishes in another conversation, a clickable notification appears in the upper-right corner. It shows the conversation title and a cleaned plain-text preview instead of raw Markdown. Select it to return to the completed conversation.

![NextClaw showing a clickable result notification after a background session completes](/product-screenshots/nextclaw-background-session-notification-en.png)

This notification is useful for “the reply I was waiting for is ready.” The conversation already on screen does not trigger a redundant notification, and the notification is not a permanent record.

### Proactive inbox deliveries

When scheduled work, a background Agent, or a long-running monitor produces a report worth keeping, AI can deliver Markdown or static HTML to the inbox. The delivery persists even when NextClaw was not open and is presented the next time you return.

![A daily AI and technology briefing created by a background Agent and displayed in the inbox reader](/product-screenshots/nextclaw-ai-delivery-html-en.png)

The inbox is suited to weekly reports, research, recommendations, monitoring findings, and documents that need follow-up. You can mark items read or unread, archive or delete them, and continue the conversation from the report.

![Viewing and managing AI-delivered reports in the NextClaw inbox](/product-screenshots/nextclaw-inbox-page-en.png)

## Which one should you use?

| Situation | What NextClaw does |
| --- | --- |
| You switch conversations while waiting for a reply | Shows a completion notification that returns to the original conversation |
| A scheduled task creates a daily report, weekly report, or research result | Delivers it to the inbox with persistent unread state |
| A background monitor finds a change worth reviewing | Delivers it to the inbox for later review or follow-up |
| The result is a normal reply in the conversation already on screen | Keeps it in that conversation without another notification |

## Unread and presentation behavior

- A new delivery opens one reader when the interface is visible. Multiple items share the same reader instead of stacking dialogs.
- Closing the reader or choosing “Read later” keeps the item unread, but the same item does not repeatedly open itself.
- Opening the item intentionally, marking it read, or continuing the conversation moves it to the read state.
- The inbox defaults to Unread when actionable unread items exist. Otherwise it defaults to All, so existing history is not hidden behind an empty list.

## HTML report boundaries

The inbox supports self-contained static HTML reports. Inline styles render normally, while scripts, forms, popups, remote resources, and external network requests remain isolated. Interactive pages that require JavaScript or external services are better delivered through a trusted file preview or a Panel App.

## Continue working from a result

Select “Continue Chat” to create or reuse a linked conversation. NextClaw supplies the delivery to AI as context, so you can question a conclusion, request a revised report, or turn a recommendation into the next task without pasting the entire document again.

Related: [Inspect task results](/en/guide/results) · [Scheduled tasks](/en/guide/cron) · [Panel Apps](/en/guide/panel-apps)
