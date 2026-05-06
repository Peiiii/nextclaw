# First Useful Workflow

The quickstart proves that NextClaw runs. This page proves that it is worth continuing with.

The goal is a small but real workflow: configure a model, complete one useful conversation, then create one low-risk automation.

## 1. Check health first

```bash
nextclaw status
nextclaw doctor
```

If this already reports a problem, go to [Troubleshooting](/en/guide/troubleshooting).

## 2. Do one real conversation

Open the UI and ask for something you would actually use today, for example:

```text
Turn these rough notes into an execution checklist I can send to a teammate.
```

Avoid toy prompts. The first useful workflow should be connected to real work.

## 3. Create one reminder or scheduled job

Now let NextClaw do one small thing proactively, for example:

```text
Every weekday at 9:30, remind me to choose the most important task for the day.
```

To understand automation more formally, see [Run Automations](/en/guide/cron).

## 4. Decide whether to connect a channel

If you already live in a messaging app every day, connect a channel next:

- [Connect Channels](/en/guide/channels)

If you only need the local UI for now, skip channels.

## 5. Decide whether it should stay running

When you want NextClaw to become part of your daily setup, continue with:

- [Background & Autostart](/en/guide/background-autostart)
- [Remote Access](/en/guide/remote-access)
- [Docker Deployment](/en/guide/tutorials/docker-one-click)

At this point, you have moved from "it runs" to "it is useful."
