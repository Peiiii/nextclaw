---
"@nextclaw/shared": patch
"@nextclaw/kernel": patch
"@nextclaw/ui": patch
"@nextclaw/agent-chat-ui": patch
---

Use readable session IDs in conversation links and return ready-to-use resource URIs from conversation tools. Restore historical conversation links and saved views, and preserve documentation query parameters and section anchors.

Bound stalled local API and resource-content requests so resource views can show an error and offer a retry instead of loading indefinitely.

Connect text selections in global object and file previews to the chat composer, retaining their source and hiding unavailable selection actions.

Keep the floating Add to chat button opaque on hover so underlying text does not show through.

Open object resource links with their native agent, scheduled-task, project, work-item, application, connection and inbox views. Reuse domain detail components and operations across management lists and chat links instead of displaying generated Markdown descriptions.
