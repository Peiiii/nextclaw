# Claude Code / Codex / Hermes Integrations

This page solves one specific question:

**you already have NextClaw installed, and now you want to plug in `Claude Code`, `Codex`, or `Hermes` through the UI without guessing which path to take.**

## Short answer

- Want a `Claude Code` style workflow: go to `Marketplace -> Plugins` and install `NextClaw Claude NCP Runtime`
- Want a `Codex` style workflow: go to `Marketplace -> Plugins` and install `NextClaw Codex NCP Runtime`
- Want `Hermes`: go to `Marketplace -> Skills`, install `Hermes Runtime`, then use that skill in chat

## 30-second picker

| Integration | Best for | How it appears in NextClaw | Difficulty |
| --- | --- | --- | --- |
| Claude Code | Users who want a Claude-style agent/runtime flow | Adds a `Claude` session type | Medium |
| Codex | Users who want a Codex-style coding/runtime flow | Adds a `Codex` session type | Medium |
| Hermes | Users who want NextClaw to guide Hermes setup and verification | Skill-guided setup and checks | Medium |

## Shared prerequisites

Before any of the three paths, do these first:

1. open the NextClaw UI
2. in `Providers`, configure one working provider and make sure the connection test passes at least once

Why this order matters:

- `Claude` and `Codex` can both reuse the current NextClaw provider / model path
- `Hermes` is also meant to stay inside the same unified provider / model experience instead of forcing you to manage a second stack

If you have not finished this part yet, start here:

- [First Step After Install: Choose Provider Path (Qwen Portal or API Key)](/en/guide/tutorials/provider-options)

## Path A: Claude Code

This is the right path if your goal is "use a Claude-style session type inside NextClaw without dealing with command-line setup."

### Install

Recommended UI path:

1. Open `Marketplace -> Plugins`
2. Search for `Claude`
3. Install `NextClaw Claude NCP Runtime`
4. Make sure the plugin is enabled after install

### Use

1. Open chat or create a new session
2. Confirm `Claude` now appears in session type options
3. Choose a working Claude-compatible model
4. Send this minimal verification prompt:

```text
Please reply exactly: CLAUDE-OK
```

### Success checklist

Treat the integration as ready when all three are true:

- `Claude` appears in the session type list
- the type is actually ready instead of staying unavailable
- the reply returns `CLAUDE-OK` or an equivalent short response

### If it does not work

- `Claude` does not appear: the plugin is usually not installed or not enabled
- `Claude` appears but is not ready: your current provider / model path is usually not Claude-compatible yet
- for ordinary users, do not start with advanced settings; get the current provider test working first

## Path B: Codex

This is the right path if your goal is "use a Codex-style coding/runtime flow inside NextClaw without dealing with command-line setup."

### Install

Recommended UI path:

1. Open `Marketplace -> Plugins`
2. Search for `Codex`
3. Install `NextClaw Codex NCP Runtime`
4. Make sure the plugin is enabled after install

### Use

1. Open chat or create a new session
2. Confirm `Codex` now appears in session type options
3. Choose a working model
4. Start with a minimal verification prompt:

```text
Please reply exactly: CODEX-OK
```

If that works, move on to real tasks like code explanation, repo inspection, or edit suggestions.

### Success checklist

- `Codex` appears in the session type list
- a new Codex session can start normally
- the reply returns `CODEX-OK` or an equivalent short response

### Ordinary-user recommendation

For the first successful `Codex` setup, ignore advanced options.

You only need this:

- plugin installed
- `Codex` session type appears
- one minimal verification reply succeeds

## Path C: Hermes

`Hermes` should not be explained to ordinary users as "go write runtime config yourself."

The ordinary-user path should be:

- install `Hermes Runtime` from `Marketplace -> Skills`
- return to chat and open `Skills`
- enable `Hermes Runtime`
- ask NextClaw to help connect and verify Hermes

### Install

1. Open `Marketplace -> Skills`
2. Search for `Hermes Runtime`
3. Click `Install`

### Use

1. Return to chat
2. Click `Skills` under the input box
3. Select `Hermes Runtime`
4. Send a request like:

```text
Help me connect Hermes and check whether it is ready to use.
```

### Success checklist

- the skill can be selected normally
- NextClaw starts guiding the Hermes setup/check flow
- if the environment is already ready, it can finish one real Hermes verification
- if the environment is not ready yet, it should tell you what is missing instead of asking you to hand-write runtime config

## Recommended verification order

For all three integrations, use the same order:

1. confirm the provider test already passes
2. install the plugin or skill from the UI
3. run one minimal verification
4. only then move to real tasks

This makes troubleshooting much faster because you can isolate whether the issue is:

- provider setup
- plugin / skill installation
- or the task itself

## Related Docs

- [Model Selection](/en/guide/model-selection)
- [Skills Tutorial](/en/guide/tutorials/skills)
- [Tutorial Hub](/en/guide/tutorials)
