---
"@nextclaw/ui": minor
"@nextclaw/agent-chat-ui": minor
"@nextclaw/kernel": minor
"@nextclaw/shared": minor
"@nextclaw/server": patch
"nextclaw": minor
---

Use a unified resource workbench to open conversations, files, apps, and object snapshots in the main area, right sidebar, or floating views. Keep content and reading position when changing presentation, and pin supported resources to the left Pages section.

Follow ordinary Markdown resource links with consistent icons and opening behavior. Shared page actions include opening, pinning, copying the URI, and adding a resource to chat; overflow controls use vertical dots and remain accessible on hover, keyboard focus, and touch.

Reference installed and project skills, scheduled tasks, inbox deliveries, agents, projects, panel apps, service apps, MCP connections, and project work items through the NextClaw Resource Protocol. AI tools and the `nextclaw resources list` / `resolve` commands discover the same real object URIs and immutable snapshots without executing their contents or exposing connection credentials.

Keep resource-link avatars at inline text size even inside Markdown with body-image styles. Panel app objects include a read-only metadata snapshot linking to the original interactive application.

Open ordinary Panel app resource links in the global right sidebar by default while preserving explicit main-area actions and existing-view reuse.

Expose registered object types to AI without enumerating instances, make unfiltered resource discovery metadata-only, and clarify that valid resource links do not require catalog membership. Panel apps can also be found by app ID.

Make concrete resource names clickable by default in AI Markdown replies when listing, recommending, locating or delivering results, without requiring a separate request for links. Preserve accurate identities and avoid unnecessary links or side effects.
