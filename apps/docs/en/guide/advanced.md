# Advanced Configuration

Advanced configuration is for users who already have NextClaw running and know what they need to change.

If you have not received the first useful reply yet, start with [Quickstart](/en/guide/getting-started).

## What belongs here

- workspace templates
- exact configuration paths
- multiple models or session bindings
- advanced runtime parameters
- local debugging and scripted maintenance

## What should not start here

Do not use advanced configuration for first install.  
Do not change many settings at once just to be "complete."  
Do not write secrets directly into ordinary config files.

## Recommended order

1. Finish the basic setup in the UI.
2. Confirm health with `nextclaw doctor`.
3. Edit exact configuration paths only when needed.
4. Change one direction at a time and verify the result.

## Command entry points

```bash
nextclaw config get <path>
nextclaw config set <path> <value>
nextclaw config unset <path>
```

For all commands, see [Command Index](/en/guide/commands).
