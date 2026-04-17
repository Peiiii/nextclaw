# NextClaw Hermes ACP Bridge

This package contains Hermes-specific ACP bridge helpers.

It is intentionally separate from the generic
`@nextclaw/nextclaw-ncp-runtime-stdio-client` package so the stdio runtime stays
protocol-generic while Hermes keeps its own integration layer.
