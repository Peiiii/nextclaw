# Run Automations

Automations let NextClaw act on a schedule, not only when you send a message.

For the first automation, start with a low-risk reminder. Do not begin with a high-impact task.

## Good first automation tasks

- remind you to choose the most important task each morning
- draft a daily status update
- summarize a project on a schedule
- continue a session at a later time

## Recommended first step

Create a simple reminder:

```text
Every weekday at 9:30, remind me to choose the most important task for the day.
```

After that triggers correctly, add more complex jobs.

## Automations and sessions

If a job should continue existing context, bind it to a session.  
If it should be independent, let it use its own automation session.

## Command entry points

Common operations include:

```bash
nextclaw cron list
nextclaw cron add
nextclaw cron run <jobId>
nextclaw cron disable <jobId>
```

For all options, see [Command Index](/en/guide/commands).

## Related docs

- [First Useful Workflow](/en/guide/after-setup)
- [Chat & Sessions](/en/guide/chat)
- [Runtime & Hosting](/en/guide/runtime-hosting)
