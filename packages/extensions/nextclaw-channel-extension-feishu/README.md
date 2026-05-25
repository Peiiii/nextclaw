# @nextclaw/channel-extension-feishu

Lightweight Feishu/Lark channel extension for NextClaw.

This extension uses the new NextClaw extension process model and supports QR
scan-to-create onboarding inspired by Hermes Agent:

1. Start channel auth from the UI or service API.
2. Scan the Feishu/Lark QR code.
3. The platform creates a bot application and returns app credentials.
4. Credentials are stored under `NEXTCLAW_HOME/channels/feishu`.
5. The extension connects through the Lark WebSocket client.

This extension replaces the removed legacy Feishu channel package. It contributes
the built-in `feishu` channel id through the extension mechanism, so QR
onboarding, WebSocket inbound messages, NCP replies, and Feishu processing
reactions now live in one lightweight channel owner.
