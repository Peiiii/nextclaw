# Troubleshooting

This page is for recovery, not onboarding. When something fails, narrow it down in this order.

## 1. Is the service running?

```bash
nextclaw status
nextclaw doctor
```

If the service is not running, start it:

```bash
nextclaw start
```

If the state is abnormal, try:

```bash
nextclaw restart
```

## 2. The UI does not open

Check:

- the URL is `http://127.0.0.1:55667`
- the service is actually running
- the port is not occupied
- logs do not show a startup error

## 3. The model does not reply

Check:

- the provider was saved
- the API key or login state is valid
- the default model exists
- the machine can reach the provider

## 4. A channel cannot connect

Check:

- token expiration
- channel permissions
- platform callback or network reachability
- `nextclaw channels status`

## 5. Automation does not trigger

Check:

- the job is enabled
- the schedule matches your expectation
- the service was running at trigger time
- the job is not bound to the wrong session

## Useful diagnostics

```bash
nextclaw status --verbose
nextclaw doctor --verbose
nextclaw service autostart doctor
nextclaw remote doctor
```

## Still stuck?

Collect:

- NextClaw version
- operating system
- installation method
- `nextclaw status` output
- `nextclaw doctor` output
- reproduction steps
