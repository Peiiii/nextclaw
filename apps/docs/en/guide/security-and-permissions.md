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

## Desktop app access

On macOS, Accessibility permission is granted once to `NextClaw Desktop` in System Settings. Turning on that system permission does not automatically let every AI agent or Extension access every app. When one first tries to read, watch, or write to an app, NextClaw shows who is requesting access, the target app, and the requested action so you can allow or reject it.

Open **Settings → Desktop Access** to check the Desktop Host and Accessibility status, review app access for AI agents and Extensions, and revoke a specific action at any time. Access follows the stable AI agent or Extension identity rather than one session. Revoking it immediately stops the related reads, watches, or writes.

AI agents currently enter Desktop capability through one restricted `node_repl`; it injects only a `desktop` SDK to read a visible interface and click or enter text by element or coordinates. Every action must include a freshly read interface state and element index; an expired state or replaced target element is rejected and must be read again. For custom-drawn interfaces that expose no Accessibility element, a separately authorized screenshot and pointer-input path can click only inside the same freshly captured target window. Coordinates use the screenshot's top-left origin and the Host maps them to the matching window; a changed capture boundary, expired state, or out-of-window coordinate is rejected. The SDK does not prohibit actions such as Send or Confirm based on button text; whether to take those actions is determined by your task instruction and the Agent authorization flow. The REPL receives no access to local files, the terminal, the network, environment variables, native Desktop APIs, or arbitrary packages.

Desktop writing and clicking require authorization for the target application. Screenshot-based coordinate clicks must stay inside the authorized, freshly captured target window and need separate pointer-input permission. Key presses, scrolling, dragging, recording, and background Desktop history are not available yet. For continuous attention to WeChat and other apps, the AI uses an Extension-backed session relationship that you can pause, resume, or remove.

Some desktop apps do not expose chat text through Accessibility. To read visible content in those windows, the AI requests a separate permission to capture the current window, and macOS must also grant Screen Recording permission to `NextClaw Desktop`. The capture is limited to the authorized target window. NextClaw recognizes its text on-device and sends the result to the model you selected for summarization. When using a hosted model, visible window text follows that model provider's data path, so allow it only when both the content and model choice are appropriate.

## High-impact actions

Preview deletion, overwrites, outbound messages, public publishing, production data changes, and paid actions before confirmation. Verify the actual file, page, or message after execution.

## Local-first does not mean offline

NextClaw's service and data run in your environment, but hosted models, channels, MCP servers, websites, and remote services can still receive task data. Evaluate the complete call path.

Related: [Continuous attention](/en/guide/agent-observation), [Secrets](/en/guide/secrets), [Messaging channels](/en/guide/channels), and [Remote access](/en/guide/remote-access).
