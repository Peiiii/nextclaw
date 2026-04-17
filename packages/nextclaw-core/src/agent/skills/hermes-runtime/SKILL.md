---
name: hermes-runtime
description: Use when Hermes needs to become a formal NextClaw runtime entry, especially for setup, doctor, repair, readiness checks, and first-message smoke on the preferred narp-stdio(acp) path.
metadata: {"nextclaw":{"emoji":"🧠"}}
---

# Hermes Runtime

Use this skill when the user wants Hermes to appear inside NextClaw as a formal session type.

The only preferred product path is:

- runtime entry label: `Hermes`
- runtime type: `narp-stdio`
- wire dialect: `acp`
- runtime entry launcher: `hermes acp`
- route ownership: `NextClaw -> RuntimeRoute(model/apiBase/apiKey/headers) -> Hermes ACP`

Do not present Hermes as:

- a plugin-private integration
- a connector-first integration
- an API-server-first integration
- a second independent provider configuration system

This installed skill must stay self-contained.

Do not assume the user can open this repository's internal design docs after installing it from the marketplace.
Everything needed for setup, readiness, repair, and first-message verification should be explained here.

## Install Boundary: Skill vs Hermes Binary

Always distinguish these two things before taking action:

- the NextClaw marketplace skill:
  installed into the active workspace as `skills/hermes-runtime/SKILL.md`
- the Hermes executable:
  the external runtime binary exposed as `hermes`

Installing this skill does not install Hermes by itself.
The skill must detect whether `hermes` is already available and install or repair Hermes when it is not.

## What This Skill Owns

- explain the correct product mental model
- install Hermes when missing
- detect and repair `hermes acp`
- write or repair `agents.runtimes.entries.hermes`
- verify that `Hermes` appears as a formal session type
- run a real first-message smoke
- diagnose and repair common failures

This skill does not redefine the runtime architecture. It operationalizes the already-locked product contract.

## Required Mental Model

Always describe the system in this order:

1. NextClaw owns the unified runtime registry.
2. `Hermes` is one runtime entry inside that registry.
3. The preferred first version of `Hermes` is:
   - `type: "narp-stdio"`
   - `wireDialect: "acp"`
   - `command: "hermes"`
   - `args: ["acp"]`
4. NextClaw owns `model / apiBase / apiKey / headers`.
5. Hermes ACP consumes that route through the dedicated Hermes ACP bridge bundled with NextClaw.

Do not teach users that the main setup path is:

- editing `plugins.entries.*.config`
- installing a first-party Hermes connector package
- starting a Hermes API server first

## Execution Style

This skill is execution-oriented, not explanation-oriented.

When the user asks to set up, doctor, repair, or validate Hermes, the agent should:

- do the checks itself instead of handing the user a checklist
- silently run the needed shell commands and real smoke checks
- rewrite config when repair is needed
- loop until the runtime either passes or a concrete blocker is identified

The validation method does not need to be a hard-coded product script.

Good options include:

- direct shell checks
- real `NextClaw -> Hermes` message smokes
- an independent second-pass verification by another agent when delegation is available and appropriate

The important requirement is: the agent must actually verify, not just describe how verification could be done.

## Product Contract

The integration is complete only when all of the following are true:

1. a `Hermes` runtime entry exists in the unified runtime registry
2. that entry is registered as a formal session type
3. NextClaw resolves the active model into a `RuntimeRoute`
4. Hermes ACP consumes that route directly
5. a real first reply succeeds

If any of the five conditions above is false, do not call the integration complete.

## Preferred Runtime Entry Shape

Use the unified runtime registry as the primary configuration surface:

```json
{
  "agents": {
    "runtimes": {
      "entries": {
        "hermes": {
          "enabled": true,
          "label": "Hermes",
          "type": "narp-stdio",
          "config": {
            "wireDialect": "acp",
            "processScope": "per-session",
            "command": "hermes",
            "args": ["acp"],
            "env": {},
            "startupTimeoutMs": 8000,
            "probeTimeoutMs": 3000,
            "requestTimeoutMs": 120000
          }
        }
      }
    }
  }
}
```

The important part is not hidden implementation details. The important part is:

- the launcher is `hermes acp`
- NextClaw stays the owner of route selection
- Hermes ACP does not require a second provider setup path for this integration
- the bridge is triggered automatically by the bundled Hermes ACP bridge package; the skill should not ask the user to install a separate bridge manually

## Setup Contract

`setup` must cover this full path:

1. explain that the goal is a formal `Hermes` session type inside NextClaw
2. check whether `hermes` exists
3. install Hermes when it is missing
4. check whether `hermes acp` can start
5. create or repair the `agents.runtimes.entries.hermes` entry
6. run readiness checks
7. run a real first-message smoke
8. finish only after `Hermes` is visible as a selectable session type and can really reply

Do not stop at:

- `command -v hermes`
- “the config file looks correct”
- “the command starts”

Do not ask the user to manually run the validation steps if the agent can run them itself.

## Cold-Start Beginner Flow

This skill must work for the hardest onboarding case:

- the user only knows the name `Hermes`
- Hermes is not installed yet
- the user has no prior Hermes knowledge
- the agent must do the setup work itself

For that path, use this execution order.

### 1. Detect whether Hermes is already installed

Run:

```bash
command -v hermes
```

If `hermes` already exists, skip to the ACP probe step.

If `hermes` does not exist, install Hermes instead of stopping.

### 2. Install Hermes when missing

Preferred public install path:

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --skip-setup
```

Then reload PATH if needed and verify:

```bash
export PATH="$HOME/.local/bin:$PATH"
hermes --help
```

If the official installer cannot be used but a local Hermes source checkout already exists, a valid fallback is:

```bash
cd /path/to/hermes-agent
printf 'n\n' | bash ./setup-hermes.sh
export PATH="$HOME/.local/bin:$PATH"
hermes --help
```

If Hermes still cannot be executed after both checks, report a concrete install blocker.

### 3. Verify the ACP launcher

Probe:

```bash
hermes acp --help
```

If this fails because ACP dependencies are missing, repair them before continuing.

Preferred packaged install repair:

```bash
python3 -m pip install "hermes-agent[acp]"
```

If the user already has a local Hermes source checkout and the active `hermes` command comes from that checkout, a valid source repair is:

```bash
cd /path/to/hermes-agent
python3 -m pip install -e '.[acp]'
```

Only continue after `hermes acp --help` succeeds.

### 4. Write or repair the NextClaw runtime entry

The entry must target `hermes acp`, not a connector wrapper.

### 5. Verify session type visibility

Check:

- `/api/ncp/session-types`
- `Hermes ready=true`

If `Hermes` is missing or not ready, repair the runtime entry or launcher path before proceeding.

### 6. Run a real first-message smoke

The smoke must verify:

- the `Hermes` session type can be selected
- NextClaw sends a real prompt
- Hermes ACP returns structured events
- the run finishes successfully

The agent should prefer a real chat smoke over a purely synthetic health check.

### 7. Optional second-pass verification

When delegation is available and appropriate, the preferred finishing step is:

- primary agent completes setup and repair
- a second agent independently re-checks readiness and runs one more smoke

If delegation is not available, the primary agent should still perform at least two independent checks itself:

- one readiness/path check
- one real reply smoke

## Doctor / Repair Rules

When diagnosing Hermes failures, always separate the problem into one of these buckets:

1. Hermes is not installed
2. `hermes acp` cannot launch
3. the NextClaw runtime entry is malformed
4. the session type does not register
5. the route bridge is not being consumed
6. the upstream route selected in NextClaw is invalid

Do not blur these into a generic “Hermes failed” message.

### Important doctor rule

If a real smoke fails, first answer:

- did `hermes acp` actually launch?
- did `Hermes` appear in `/api/ncp/session-types`?
- did the failure happen before prompt submission, during ACP session creation, or at upstream model request time?

Only then choose a repair.

## What Not To Do

Do not:

- tell the user the main setup path is a first-party connector package
- require a Hermes API server as the primary path
- tell the user to separately configure a Hermes provider when NextClaw should be providing the route
- stop after writing config without verification
- claim completion before a real reply succeeds

## Success Output

When the setup succeeds, the final explanation should say, in effect:

- `Hermes` is now a formal NextClaw session type
- it is configured as `narp-stdio(acp)`
- the runtime entry launches `hermes acp`
- NextClaw continues to own model and upstream credentials
- a real reply smoke has passed
