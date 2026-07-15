# Scheduled tasks

Scheduled tasks rerun proven work at a chosen time: a daily brief, weekly project summary, reminder, or recurring website check.

![The NextClaw scheduled task list](/product-screenshots/nextclaw-cron-job-page-en.png)

## Run it manually first

Complete the task in a normal session before scheduling it. Confirm the sources, working directory, output format, and destination, then ask the agent to create a schedule from the working prompt.

```text
Run the brief we just completed every weekday at 08:30. Read daily-sources.md, produce a Markdown brief, and send it to the configured Feishu group. If there is no new item, still report the check time and sources.
```

## What a schedule contains

- the prompt to execute;
- timing and timezone;
- working directory or session;
- enabled state;
- previous and next run times;
- a destination channel when results should be sent.

Use the schedule page to enable, disable, run now, and inspect timing. Run it manually again after changing a model, directory, channel, or credential.

Scheduled work should be low-risk, stable, reviewable, and retryable. Keep explicit confirmation around public publishing, destructive changes, sensitive messages, production data, and paid actions.

See [Generate and send a scheduled brief](/en/tasks/scheduled-brief) for a complete example.
