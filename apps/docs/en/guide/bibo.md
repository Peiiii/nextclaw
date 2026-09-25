# Bibo hosted companion

Opening or closing mobile navigation does not show an unsolicited icon tooltip. Keyboard users can Tab into the drawer, press Escape to close it, and return focus to the menu button.

Deleted or missing conversation links show an explicit error instead of opening an unrelated conversation. Select another conversation from the list or start a new one to continue.

The right workspace remembers its open state and selected file, and reloads saved content after refresh. Closing and reopening preserves current edits; save before refreshing. Failed reads show an error and a retry action. A late response cannot reopen a workspace you have closed.

Long conversation titles are shortened in the toolbar so New conversation and Workspace remain accessible. Open Rename from the conversation menu to view the full title. Long task, inbox, and note names use up to two lines in lists; open their details or editor to read the full content.

Closing a modified file offers Save and close, Discard changes, or Cancel. Failed saves keep the tab and draft for retry; tabs cannot close while saving. Deleting tasks, events, files, or projects uses a confirmation dialog that stays open on failure. Deleting a project retains its tasks.

[Bibo](https://app.bibo.bot/) is a separate web service powered by the NextClaw agent runtime. You can register with an email code and start with a concrete task without installing NextClaw.

The app opens on an overview of upcoming events, active tasks, inbox items, and recent notes. Its brief opens the inbox, tasks, or chat according to what needs attention, while real items in each card open their source. Chat has its own section with multiple conversations that you can create, switch, rename, and delete. A right workspace can show a file beside the conversation. Bibo displays answer text as it is generated; a reply enters conversation history only after saving completes. You can stop generation, and an interrupted or unsaved request leaves the original input ready to retry. The composer stays visible while long conversations scroll.

The inbox brings together first-party reminders, decisions, and deliveries from the NextClaw agent. You can read, resolve, and follow items back to their source. If a source was deleted or is unavailable, its inbox detail stays open with an explanation so you can retry. Calendar opens in month view, with event summaries on each date and a full list for the selected day. Click empty space anywhere in a date cell to select that day. Day and week views, event creation, editing, and deletion are also available. Tasks include projects, priority, start and due dates, subtasks, and planned, active, completed, or cancelled states. List and board rows show the project and state directly; search titles and descriptions to narrow them. When tasks or inbox items span multiple pages, load more at the bottom of their respective lists. Notes provide a quick writing entry sorted by recent edits, while Files shows the underlying path-ordered folder tree, multiple editor tabs, and move or rename actions. Each list can load more items in place. Notes and Bibo-produced artifacts share the same file space. Bibo can discover and call structured actions for these sections through one on-demand capability.

Chat replies, file previews, and inbox bodies share Markdown reading styles for tables, task lists, math, and Mermaid diagrams. Code blocks show their language and can be copied independently. You can view diagram source, and invalid diagrams retain their source text. Images load only over HTTPS and show alternative text if loading fails. Unsafe or unresolved file links do not navigate.

Find search and creation controls in the file tree. The tree and open tabs use matching icons to distinguish folders, notes, AI artifacts, and common document types. The editor toolbar contains edit/preview and save controls; use “More” to move, rename, or delete a file. Version conflicts preserve your draft: you can confirm loading the latest version or overwriting it with your draft. Another concurrent change still blocks the overwrite. On mobile, return to the tree or notes list from the top row. The workspace beside chat has a file selector at the top. Calendar details open beside the desktop calendar, with a return action on mobile. Task fields scroll independently while save controls remain visible.

Navigate the file tree with Up/Down, expand or enter children with Right, and collapse or return to the parent with Left. Home/End move to the first/last visible node; Enter opens a file. Drag the tree divider to resize it, or focus the divider and use Left/Right. The active file tab scrolls into view when switching among many files. Switching tabs or hiding the tree preserves unsaved edits.

An expanded empty folder says that it is empty; use that folder's action button to add content.

Each account has an isolated runtime. You can clear your Bibo conversation and workspace from the web app. Inbox does not imply a connection to an external email account. External email and calendar accounts, web search, background schedules, and proactive notifications are not yet available. The current compressed workspace snapshot limit is 32 MiB; exceeding it reports a save failure.

The initial limit is 12 requests per hour and 4,000 characters per request, with 30 model calls per account per day and 200 model calls across the service per day. Account authentication uses the NextClaw platform; Bibo provides a separate, capped model trial. When the trial quota is exhausted, Bibo reports it before sending; a new conversation does not gain an empty session, and the input remains available to retry later. Background scheduled work and proactive notifications are not available yet. Check important results before relying on them.

See [Bibo help](https://app.bibo.bot/help.html) for usage and data details. The local-first NextClaw workspace remains available through the [installation guide](/en/guide/install).

“New conversation” opens a blank page without adding an empty session to the list. A session is created when you send the first message. Use the session menu to rename or delete it. The bottom-left account menu groups help, sign-out, and reset actions; desktop sidebar controls stay at the top. File, note, and project creation and file renaming use dialogs that retain your input and show errors when saving fails. Mobile navigation opens in a side sheet.
