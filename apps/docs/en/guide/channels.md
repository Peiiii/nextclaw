# Connect Channels

Channels let you use NextClaw from the messaging surfaces you already use, not only from the local UI.

For the first channel, choose one place you actually open every day. Do not connect many channels at once.

## Before connecting a channel

You should already have:

- completed the [Quickstart](/en/guide/getting-started)
- one working model provider
- `nextclaw status` showing the service is running

## Connection flow

1. Choose the channel type in the UI or configuration.
2. Add the required account, token, or login details.
3. Save the configuration.
4. Run `nextclaw channels status`.
5. Send one test message from the target channel.

## Which channel should I choose?

Start with the place where you already work:

- team collaboration: Slack, Feishu, enterprise chat
- personal messaging: Telegram, Discord
- custom or experimental flows: webhook, MCP, or another extension entry

## Common failure points

- token is wrong or expired
- the platform permissions are incomplete
- the local machine cannot reach the platform
- the service is not staying online

## Related docs

- [Feishu Setup](/en/guide/tutorials/feishu)
- [Secrets Management](/en/guide/secrets)
- [Troubleshooting](/en/guide/troubleshooting)
