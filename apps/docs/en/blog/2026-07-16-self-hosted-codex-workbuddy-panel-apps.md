---
title: "2026-07-16 · A Self-Hostable Codex / WorkBuddy with Built-In Mini Apps"
description: "NextClaw is an open-source, self-hostable Codex / WorkBuddy that can also turn one-off needs into reusable Panel Apps."
---

# NextClaw: A Self-Hostable Codex / WorkBuddy with Built-In Mini Apps

Published: 2026-07-16

Tags: `open source` `agents` `self-hosting` `Panel Apps`

Hi, I am the author of NextClaw.

You can think of NextClaw as an open-source Codex / WorkBuddy that you can host yourself.

NextClaw is not a stripped-down alternative. Like Codex, it can read and modify code in a project and run commands. Like WorkBuddy, it can research topics, organize files, draft documents, and handle everyday tasks. Recurring work can run on a schedule, and tasks can arrive from Weixin, Feishu, QQ, and other messaging channels in the same way people use OpenClaw. You can use NextClaw's built-in agent or connect third-party agent runtimes such as Codex and Claude Code.

It is available as a desktop app and can also run on Linux, Docker, a NAS, or a cloud server.

The part I want to highlight is its built-in mini-app system, currently called Panel Apps.

For example, if you regularly merge CSV files, you can ask:

> Build a CSV merge tool. Let me choose multiple files, preview their names and row counts, then confirm the merge and download the result.

The agent can build the app and open it beside the conversation.

Here is another example: a local data dashboard open beside its task.

![A local data dashboard running beside a NextClaw task](/product-screenshots/nextclaw-workspace-preview-en.png)

Finished Panel Apps appear in the app list. You can pin them to the side dock and open them again later.

![The NextClaw Panel Apps list](/product-screenshots/nextclaw-panel-apps-page-en.png)

If something does not work the way you want, keep talking to the agent and change it.

The result is not only a conversation, a code snippet, or an HTML file left in a folder. It becomes a small app you can keep using. Calculators, dashboards, file-processing tools, and local search pages can all work this way.

Install with npm:

```bash
npm install -g nextclaw
nextclaw start
```

Then open:

```text
http://127.0.0.1:55667
```

If you do not want to use npm, desktop builds are available for macOS, Windows, and Linux, along with Docker deployment.

I am not claiming that NextClaw is better than Codex or WorkBuddy in every detail. Mature products still have advantages in polish, latency, and specialized workflows.

NextClaw is a better fit when:

- you want the system to run on your own computer, NAS, or server;
- you are a developer or open-source enthusiast who wants to study a complete agent product or build your own version from the source;
- you often want small tools for yourself without creating, deploying, and maintaining a separate project every time.

Self-hosting does not mean that task data can never leave your machine. Cloud models, messaging channels, and connected services may still receive the data required to complete a task.

The project is fully open source:

- GitHub: [github.com/Peiiii/nextclaw](https://github.com/Peiiii/nextclaw)
- Website: [nextclaw.io](https://nextclaw.io/)
- Documentation: [NextClaw Docs](/en/)

If an agent could build a small app beside your task and keep it available for later, what would you build first?
