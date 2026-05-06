# Remote Access

Remote Access turns the local NextClaw UI into a personal console you can open from other devices through your own network path. The core product rule is simple: the primary workflow should live in the UI, not in CLI-only knowledge.

If you are still deciding whether your next step is background runtime, autostart, or remote access, start here first:

- [Runtime & Hosting](/en/guide/runtime-hosting)

## What This Page Covers

The `Settings -> Remote Access` page now combines:

- browser-based platform authorization
- device-level remote settings
- managed service control
- remote diagnostics

That gives you one continuous browser workflow:

1. Log into the NextClaw platform.
2. Enable remote access and name the device.
3. Start or restart the managed service.
4. Run diagnostics and confirm the connector is healthy.

## Browser Authorization Flow

The `Platform Account` card no longer depends on typing email and password into the local NextClaw UI.

Instead, it now uses a portal-style browser authorization flow:

1. Click `Continue in Browser`.
2. A NextClaw platform page opens in your browser.
3. Sign in there, or create an account there if needed.
4. Return to the local UI and let it finish polling automatically.

This matters for the logout case too: after you click `Logout`, you use the same browser authorization entry again. There is no hidden CLI-only recovery path.

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

- [Runtime & Hosting](/en/guide/runtime-hosting)
- [Background & Autostart](/en/guide/background-autostart)
- Step-by-step walkthrough: [Remote Access UI Tutorial](/en/guide/tutorials/remote-access-ui)
- General troubleshooting: [Troubleshooting](/en/guide/troubleshooting)
