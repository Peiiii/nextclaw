# Generate and Send a Scheduled Brief

Use this workflow for daily updates, project status, industry news, link changes, service checks, and personal reminders. Build and send one good brief manually before creating the schedule.

## Prepare before you start

- The data, pages, files, or project directory to read.
- Delivery time, time zone, and workday rules.
- A destination such as a local session, messaging channel, or email integration.
- Failure notifications and any high-risk actions that must never run automatically.

## 1. Generate one brief manually

<div class="nc-task-prompt">
  <p>Create today's project brief. Summarize the main changes from the past 24 hours, unfinished work, and questions that need my decision. Keep links to the supporting files or pages. Show the result in this session first and do not create a scheduled job yet.</p>
</div>

Review length, sources, ordering, and tone. If a channel will receive the brief, send one manual test first.

## 2. Create the automation

<div class="nc-task-prompt">
  <p>Turn the approved brief into a scheduled task. Run it at 9:00 every weekday in the Asia/Shanghai time zone and send it to the selected Feishu conversation. If data collection or sending fails, record one error in this session and do not send duplicates.</p>
</div>

Open Scheduled Tasks and confirm the schedule, status, destination session, and next run time.

## 3. Run an immediate test

Do not wait until the next day to discover a problem. Run it once and check:

- The correct data range was used.
- The message was sent exactly once.
- Length and formatting work in the destination.
- Failures contain enough information to investigate.
- The job uses the intended existing or isolated session.

## Common refinements

- Run only on workdays or skip holidays.
- Do not send when there is no content, or send a short status instead.
- Keep only high-priority items and decisions.
- Use separate sessions and destinations for different projects.
- Produce a deeper weekly trend review.

Related: [Run Automations](/en/guide/cron) · [Connect Messaging Channels](/en/guide/channels) · [Background and Autostart](/en/guide/background-autostart)
