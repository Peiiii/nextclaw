# Quickstart

This page has one job: help you prove that NextClaw can run, open, and return one useful reply.

## 1. Prepare Node.js

The NPM install path requires Node.js and npm.

```bash
node -v
npm -v
```

If either command is missing, install the Node.js LTS release and reopen your terminal.

## 2. Install NextClaw

```bash
npm i -g nextclaw
```

This installs the CLI. It does not automatically register a login or boot-time autostart entry.

## 3. Start the service

```bash
nextclaw start
```

Then open:

```text
http://127.0.0.1:55667
```

## 4. Finish the minimum setup

In the UI, do three things:

1. Add one model provider.
2. Select a default model.
3. Save the configuration.

If you are not sure which provider path to choose, start with [Pick a Provider Path](/en/guide/tutorials/provider-options).

## 5. Send the first message

Use a real request, for example:

```text
Turn the three things I need to do today into a short checklist.
```

If you get a normal reply, the minimum setup is complete.

## Useful checks

```bash
nextclaw status
nextclaw doctor
nextclaw stop
```

For the complete command surface, see [Command Index](/en/guide/commands).

## Next step

- [First Useful Workflow](/en/guide/after-setup)
- [Set Up Providers](/en/guide/model-selection)
- [Background & Autostart](/en/guide/background-autostart)
