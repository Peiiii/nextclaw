# Doc Browser

Doc Browser is the global browsing area in NextClaw's right dock. Keep websites, documentation, and multiple tabs open while you continue working in the main task. The browser can be docked or floated.

![Documentation open beside the Skill marketplace](/product-screenshots/nextclaw-skills-doc-browser-en.png)

## Doc Browser versus session workspace

- **Session workspace** focuses on the current task's local files, results, subtasks, and schedules.
- **Doc Browser** persists across product pages for websites, documentation, GitHub, and other references.

Use it to read a Skill or MCP guide while installing it, compare source pages during research, inspect a repository, or keep several references available while navigating NextClaw.

Opening a page in Doc Browser does not automatically send it to a model or let an agent control it. That depends on the tools and instructions used by the current task.

## Consistent view controls

The global browser, session workspace, and floating conversation share window controls:

- **Float view group / Dock to sidebar** moves the entire tab group, keeping its content and navigation history.
- **Collapse view / Expand view** keeps a labeled restore bar without closing tabs or stopping tasks.
- **Maximize / Restore size** fills the application area temporarily, then restores the previous location and size.
- **Close tab** closes one tab; **Hide view group** keeps its tabs for reopening from the original entry.
- Pinning a shortcut is separate from docking a window. The right shortcut rail stores independently reconstructable entries; snapshot-backed file previews can be pinned to left Pages with their required context.

Drag empty title-bar space to move a floating window and its edges or corners to resize it. Double-click empty title-bar space to maximize or restore. Focus the sidebar divider and use arrow keys or Home/End to resize it. Escape restores a maximized window first, then collapses a floating window. Narrow screens use a full-screen layout.

## Navigation and memory

Back and forward affect only their view group, not the main conversation route. Opening new content after going back starts a new history branch. Docking, floating, collapsing, and maximizing do not recreate the current content instance.

Placement and floating geometry survive reloads and are constrained to the current screen. Supported files, conversations, and bridged pages remember reading positions by resource and page URL; they restore after reopening or reloading and yield when you scroll yourself. Restored conversation reading is not pulled to the bottom by incoming content. Returning to the bottom resumes following new messages.

Cross-origin websites restore internal scrolling or application state only when they support the bridge. NextClaw does not bypass browser security to inspect arbitrary pages.

## Pages, resource links, and shared actions

The left **Pages** section can pin apps, conversations, file previews, and ordinary product pages. Existing app pin preferences are preserved. Page and tab menus share applicable opening locations, left pinning, **Add to chat**, and **Copy resource link**. Content-specific actions, such as source/rendered file views, remain available.

A resource link identifies content, not a temporary window. A normal Markdown link can point to an installed Panel App:

```markdown
[My tasks](nextclaw://panel-app/my-todos)
```

Replace the example app ID with a real one. For conversations, files, and other pages, use **Copy resource link** instead of constructing the URI manually. Links display a resource-specific icon, falling back to a category icon and then a generic link icon. They remain ordinary links, not embedded app cards.

Internal links first reuse an already open resource view. Otherwise conversations and apps with main routes open in the main area; reference materials open in the global sidebar. Explicit menu choices override this default. Ordinary external website links retain external browsing behavior. Unknown internal resources show an unavailable notice instead of executing an unknown scheme.

Pinning does not copy resource data or change permissions. **Add to chat** inserts a reference without sending a message. Main-page-dependent forms such as settings only offer main-area opening. Generic page pins are local to the browser; app pin preferences keep their existing server-side owner.

File links retain their source directory. Historical diffs require a retained snapshot in a view or pin; a missing snapshot is never replaced with current file content. Reading positions use bounded browser-session memory. Cross-origin internal state still depends on the page's supported bridge.

## NextClaw Resource Protocol

The NextClaw Resource Protocol describes conversations, Panel Apps, files, and pages consistently. A resource is identified by its URI; a view retains navigation and reading state; a container places the view in the main area, sidebar, or floating window. A left-side pin is an entry point, not a copy.

Add to chat passes a resource reference to the AI, which can cite a known URI in an ordinary Markdown link. The Panel App display tool also returns a linkable `resourceUri`. A reference identifies a resource; it does not mean the AI has read its live content or gained access permissions. Ordinary links and inline embeds are separate operations.


### Skills, scheduled tasks, and object resources

Installed and project skills, scheduled tasks, inbox deliveries, agents, projects, service apps, MCP connections, and project work items have individual resource references. Page actions offer opening, pinning, adding to chat, and copying the URI. An installed skill identifies its exact source; a marketplace listing is a different resource.

Use ordinary Markdown `[label](real URI)`. Copy a link from the UI or discover it with `nextclaw resources list --type skill` or `nextclaw resources list --type cron-job`. `nextclaw resources resolve '<URI>'` returns an immutable snapshot reference. These commands require the local service; they do not create separate data or execute tasks.

AI tools `resource_list` and `resource_resolve` consume the same catalog. Adding an object to chat carries an explicit snapshot, not authorization to execute its contents. Missing objects, unregistered types, and loading failures have distinct messages. Never guess resource IDs.

File links accept `nextclaw://file/absolute/path/without/leading/slash` or `nextclaw://file/workspace/relative/path?base=encoded-absolute-directory`, optionally with `view=source&line=12&column=3`. Relative links inside a conversation use that message's source directory. Preserve base when sharing elsewhere; another conversation's directory must not be substituted.

Contextual workspace pages, such as a conversation overview or file tree, remain owned by their conversation. Their shared menu offers Maximize instead of a separate main page; ordinary settings routes open only in the main area. Object snapshots keep reading positions by resource URI, even when their snapshot filenames are identical.
