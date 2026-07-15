# Security and permissions

NextClaw can work with local files, the terminal, websites, external services, and messaging channels. Match every permission to a concrete task.

## Working directories

Choose the narrowest useful project directory. Do not expose an entire home directory by default. Keep source files and place bulk-processing output in a separate directory.

## Secrets and accounts

Store model API keys, channel credentials, and service tokens in the appropriate settings. Do not paste them into tasks, skills, repositories, or screenshots. Remove related schedules and channel settings when revoking a service.

## Skills, MCP, and Service Apps

Review the source, tools, and permission scope before installation. Test against a safe directory first. Do not make sensitive or high-impact tools available to every agent without a real requirement.

## Messaging channels

Decide who may trigger an agent, which model receives group content, and where results return. Public or shared entry points should not connect directly to a high-privilege workspace.

## High-impact actions

Preview deletion, overwrites, outbound messages, public publishing, production data changes, and paid actions before confirmation. Verify the actual file, page, or message after execution.

## Local-first does not mean offline

NextClaw's service and data run in your environment, but hosted models, channels, MCP servers, websites, and remote services can still receive task data. Evaluate the complete call path.

Related: [Secrets](/en/guide/secrets), [Messaging channels](/en/guide/channels), and [Remote access](/en/guide/remote-access).
