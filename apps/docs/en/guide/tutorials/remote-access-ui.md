# Remote Access UI Tutorial

This tutorial follows the UI-first path for remote access.

## Before You Start

Make sure:

- your local NextClaw UI already opens correctly
- this machine has your preferred external network entry
- you know the platform API base if you are not using the default

## Step 1: Open the Page

In the UI, go to:

- `Settings`
- `Remote Access`

You will see account, device, service, and diagnostics sections on one page.

## Step 2: Log Into the Platform

In `Platform Account`:

1. Enter your email
2. Enter your password
3. Keep the default API base unless you need a custom one
4. Enable `Register If Needed` if the account does not exist yet
5. Click `Login to Platform` or `Create Account & Login`

## Step 3: Save Device Settings

In `Device Settings`:

1. Turn on `Enable Remote Access`
2. Set a recognizable device name
3. Optionally override the platform API base
4. Click `Save Settings`

## Step 4: Start or Restart the Managed Service

In `Managed Service`:

- click `Start Service` if it is not running yet
- click `Restart Service` after changing remote settings

If this page is currently served by the managed service itself, a restart may briefly disconnect the page.

## Step 5: Run Diagnostics

Click `Run Diagnostics` and confirm these checks are passing:

- `remote-enabled`
- `platform-token`
- `local-ui`
- `service-runtime`

## Step 6: Verify From Another Device

From your other device:

1. Open your external entry URL
2. Confirm the NextClaw UI loads
3. Open `Remote Access` and confirm the connector shows as connected
