# Remote Access UI Tutorial

This page helps you open the NextClaw UI from another device. Make sure the local instance works first.

## Prerequisites

- `http://127.0.0.1:55667` opens locally
- `nextclaw status` is normal
- you understand that remote access changes the access boundary

## Steps

1. Enable remote access.
2. Run remote diagnostics.
3. Open the remote entry from another device.
4. Send one test message.

```bash
nextclaw remote enable
nextclaw remote doctor
```

## Related docs

- [Remote Access](/en/guide/remote-access)
- [Runtime & Hosting Manual](/en/guide/runtime-hosting)
