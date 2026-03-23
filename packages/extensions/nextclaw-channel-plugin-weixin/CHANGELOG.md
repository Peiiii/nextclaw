# @nextclaw/channel-plugin-weixin

## 0.1.4

### Patch Changes

- Ship the Weixin QR auth flow in the UI, including plugin-backed channel auth sessions and the dedicated scan-first configuration experience.

## 0.1.3

### Patch Changes

- Republish the verified Weixin channel plugin release above already occupied npm versions so the published packages match the repository state that passed real QR login and real reply validation.
- Updated dependencies
  - @nextclaw/core@0.9.11

## 0.1.2

### Patch Changes

- Add the Weixin channel plugin with QR login, long-poll inbound handling, `context_token`-based reply delivery, and `accountId` routing across the shared host contracts.

  Expose plugin-aware `nextclaw channels login --channel weixin`, bundle the new Weixin plugin into the OpenClaw compatibility loader, and pass channel `accountId` through the message tool, cron, and service runtime so verified Weixin reply flows work end to end.

- Updated dependencies
  - @nextclaw/core@0.9.10

## 0.1.1

### Patch Changes

- Add the Weixin channel plugin with QR login, long-poll inbound handling, `context_token`-based reply delivery, and `accountId` routing across the shared host contracts.

  Expose plugin-aware `nextclaw channels login --channel weixin`, bundle the new Weixin plugin into the OpenClaw compatibility loader, and pass channel `accountId` through the message tool, cron, and service runtime so verified Weixin reply flows work end to end.

- Updated dependencies
  - @nextclaw/core@0.9.9
