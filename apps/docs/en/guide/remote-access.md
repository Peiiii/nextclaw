# Remote Access

Remote Access turns the local NextClaw UI into a personal console you can open from other devices through your own network path. The core product rule is simple: the primary workflow should live in the UI, not in CLI-only knowledge.

## What This Page Covers

The `Settings -> Remote Access` page now combines:

- platform account login or registration
- device-level remote settings
- managed service control
- remote diagnostics

That gives you one continuous browser workflow:

1. Log into the NextClaw platform.
2. Enable remote access and name the device.
3. Start or restart the managed service.
4. Run diagnostics and confirm the connector is healthy.

## Why Service Control Is Included

Remote access is applied by the managed NextClaw service. Saving settings updates config, but the connector only becomes active after the managed service starts or restarts.

The UI now exposes:

- `Start Service`
- `Restart Service`
- `Stop Service`

If the current page is already being served by that managed service, a stop or restart can briefly disconnect the page. That is expected.

## What You Can Verify

The overview and diagnostics panels help confirm:

- whether a platform token exists
- whether remote access is enabled in config
- whether the managed service is running
- whether the connector is connected
- whether the local UI health endpoint is reachable

## Related Docs

- Step-by-step walkthrough: [Remote Access UI Tutorial](/en/guide/tutorials/remote-access-ui)
- General troubleshooting: [Troubleshooting](/en/guide/troubleshooting)
