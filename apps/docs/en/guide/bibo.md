# Bibo hosted companion

The website, app and help page share a purple Bibo icon in browser tabs, making Bibo easier to find among open pages.

The overview features the website’s purple, wide-eyed companion beside the welcome greeting. The character is decorative: it is not clickable and does not react to summary interactions. A separate summary link below opens your inbox, tasks, or a conversation. The character scales down on phones to leave room for content and actions.

Forms, menus, and feedback share a consistent text hierarchy, with readable input sizes on phones. Successful task, project, event, file, and inbox actions show the updated content without a duplicate success toast. Errors remain beside the relevant input, editor, or dialog until you correct or retry the action.

File editors show Unsaved, Saving, and Saved in place. Changes typed during a save remain unsaved. Completing a task retains an undo action, and copying provides feedback on the copy button. A task saved outside the current filter offers a link to its details; saving an event shows its date.

Sections have dedicated addresses: `/chat`, `/tasks`, `/calendar`, `/notes`, `/files`, and `/inbox`, with the overview at `/`. Open an existing conversation at `/chat/conversation-id`. Refresh, Back, and Forward preserve the current location.

Creating a task starts with its name; expand Add details for optional properties. Complete or reopen a task directly from its list and undo the last status change. Today includes unfinished tasks due today or overdue; Upcoming includes unfinished tasks due from tomorrow onward. Undated tasks remain available in All. Search, project management, and list/board controls are under Filters and views.

Full task details and event editing open in dialogs. Double-click an empty calendar date to create an event. Closing an editor keeps its draft; Cancel discards it. Failed saves display an error inside the dialog. Collapsing the file tree gives the editor the full width; use the directory icon above the editor to expand it again.

On phones, the full month and selected day's agenda appear together, with event counts below dates. Notes support name search. Press Cmd/Ctrl+S in a file or note editor to save. The inbox opens on pending items and also offers unread and all items.

Opening or closing mobile navigation does not show an unsolicited icon tooltip. Keyboard users can Tab into the drawer, press Escape to close it, and return focus to the menu button.

Sections and conversations support browser Back, Forward, and direct links. Switching sections preserves the current conversation and unsent draft; returning to a new conversation restores the blank editor. Conversation links can also open in a new tab. Unsent drafts are not guaranteed to survive a refresh.

Deleted or missing conversation links show an explicit error instead of opening an unrelated conversation. Select another conversation from the list or start a new one to continue.

The right workspace remembers its open state and selected file, and reloads saved content after refresh. Closing and reopening preserves current edits; save before refreshing. Failed reads show an error and a retry action. A late response cannot reopen a workspace you have closed.

Ask “Create a report and preview it on the right.” After Bibo saves the file and requests its display, the workspace opens it automatically. Markdown and HTML support preview, with source editing available. You can also ask to display an existing file. Only saved files in your account’s personal space are shown; stopping generation or a failed save does not open that turn’s output. Automatic opening, closing, and reopening also work on mobile.

Long conversation titles are shortened in the toolbar so New conversation and Workspace remain accessible. Open Rename from the conversation menu to view the full title. Long task, inbox, and note names use up to two lines in lists; open their details or editor to read the full content.

Closing a modified file offers Save and close, Discard changes, or Cancel. Failed saves keep the tab and draft for retry; tabs cannot close while saving. Deleting tasks, events, files, or projects uses a confirmation dialog that stays open on failure. Deleting a project retains its tasks.

[Bibo](https://app.bibo.bot/) is a separate web service powered by the NextClaw agent runtime. You can register with an email code and start with a concrete task without installing NextClaw.

The app opens on an overview of upcoming events, active tasks, inbox items, and recent notes. Its brief opens the inbox, tasks, or chat according to what needs attention, while real items in each card open their source. Chat has its own section with multiple conversations that you can create, switch, rename, and delete. A right workspace can show a file beside the conversation. Bibo displays answer text as it is generated; a reply enters conversation history only after saving completes. You can stop generation, and an interrupted or unsaved request leaves the original input ready to retry. The composer stays visible while long conversations scroll.

On a phone, open the top-left menu to switch sections, open recent conversations, or reach the account menu in a compact navigation drawer. The conversation list scrolls independently when it grows. The composer keeps only actions and live status visible; quota, error, and conflict messages appear when they require attention.

When reading older messages, a circular down arrow appears at the bottom of the message area. Select it to return to the latest message; the button then disappears.

The composer uses one action slot for Send, Stop, or a waiting state. You can prepare the next draft during a reply, but cannot send concurrently. A pending stop cannot be repeated, and saving cannot be cancelled. The editor grows with multiline text, then scrolls within its height limit. Failed input returns to an empty editor; if a new draft is present, it stays intact and a Retry message action retains the failed input. Retrying preserves the new draft. Unsent drafts are not guaranteed to survive a page refresh.

The inbox brings together first-party reminders, decisions, and deliveries from the NextClaw agent. You can read, resolve, and follow items back to their source. If a source was deleted or is unavailable, its inbox detail stays open with an explanation so you can retry. Calendar opens in month view, with event summaries on each date and a full list for the selected day. Click empty space anywhere in a date cell to select that day. Day and week views, event creation, editing, and deletion are also available. Tasks include projects, priority, start and due dates, subtasks, and planned, active, completed, or cancelled states. List and board rows show the project and state directly; search titles and descriptions to narrow them. When tasks or inbox items span multiple pages, load more at the bottom of their respective lists. Notes provide a quick writing entry sorted by recent edits, while Files shows the underlying path-ordered folder tree, multiple editor tabs, and move or rename actions. Each list can load more items in place. Notes and Bibo-produced artifacts share the same file space. Bibo can discover and call structured actions for these sections through one on-demand capability.

The desktop inbox pairs a compact message list with a centered reading area. List rows separate titles, excerpts, status, and dates. Read, resolve, and source actions stay visible above long messages; on mobile, use the top bar to return to the list. An identical leading level-one or level-two heading is omitted from the reading copy; stored content is unchanged.

Chat replies, file previews, and inbox bodies share NextClaw's Markdown reader, supporting six heading levels, bullets, numbered and nested lists, task checkboxes, tables, and footnotes. Inbox bodies use tighter paragraph and heading spacing, and list previews show a readable excerpt. Long table text wraps; wide tables and code scroll within the reader on narrow screens. Code blocks show their language and syntax highlighting and can be copied independently.

Math supports `$…$`, `$$…$$`, `\(…\)`, and `\[…\]`. Code fences marked `mermaid` display diagrams with expansion, zoom, Escape to close, and a source toggle. Incomplete streamed formulas and diagrams wait for more content; invalid final diagrams show a message and retain their source. HTTPS images can be expanded and show alternative text if loading fails; your browser loads them from their source URL. Unsafe or unresolved file links do not navigate.

Ask Bibo to generate and save a document, HTML/SVG artifact, or Markdown diagram. System file links in replies open the workspace beside the conversation. Artifacts open in preview; switch to editing to save the same file shown in the Files module. References based on file IDs survive renaming and moving. Unsaved edits remain available after closing the workspace during the current page session. On mobile, close the workspace to return to the conversation. File links also open as standalone pages that can be refreshed; deleted or inaccessible references show an error. HTML/SVG previews cannot run scripts. Ordinary website links open in a new browser tab rather than inside the workspace.

Reply and code copy actions use icon buttons that briefly become checkmarks after success. Failed copies show a nearby message and can be retried. Desktop hover reveals the action name; touch devices keep a larger target. Dismissible completion notices appear at the top center. Loading states and form errors stay in the relevant content area.

Overview summaries for messages, notes, events, and tasks use consistent rounded controls with subtle whole-row hover feedback. Click a summary to open its module. Long titles retain space for status and time without moving the content on hover.

Find search and creation controls in the file tree. The tree and open tabs use matching icons to distinguish folders, notes, AI artifacts, and common document types. The editor toolbar contains edit/preview and save controls; use “More” to move, rename, or delete a file. Version conflicts preserve your draft: you can confirm loading the latest version or overwriting it with your draft. Another concurrent change still blocks the overwrite. On mobile, return to the tree or notes list from the top row. The workspace beside chat has a file selector at the top. Calendar details open beside the desktop calendar, with a return action on mobile. Task fields scroll independently while save controls remain visible.

Navigate the file tree with Up/Down, expand or enter children with Right, and collapse or return to the parent with Left. Home/End move to the first/last visible node; Enter opens a file. Drag the tree divider to resize it, or focus the divider and use Left/Right. The active file tab scrolls into view when switching among many files. Switching tabs or hiding the tree preserves unsaved edits.

Enter task names directly above the list and press Enter to keep adding tasks. The adjacent more button opens the same draft with description, subtasks, project, and date properties. Creating in Today or Upcoming assigns the corresponding due date. Double-click empty space in a month cell to create an event on that date, or click a half-hour slot in day/week view. Changing the start time preserves duration; 30/60/90-minute shortcuts adjust the end. An end before the start shows an error and blocks saving.

After a task save succeeds, the list updates immediately and the input is ready for another task. Failed saves retain the draft for retry. Saved tasks remain after refresh or runtime restart. An existing workspace may need a one-time load during its first upgrade; creating a task through chat still waits for Bibo to process the conversation.

An expanded empty folder says that it is empty; use that folder's action button to add content.

Failed file or note list reads show an error and retry action instead of an empty collection. Failed search keeps the query and offers a retry in the tree.

Failed overview, inbox, task, and calendar reads also show an error and retry action instead of empty data. Calendar keeps month navigation available, so you can retry or switch months if one month cannot load.

Each account has an isolated runtime. You can clear your Bibo conversation and workspace from the web app. Inbox does not imply a connection to an external email account. External email and calendar accounts, background schedules, and proactive notifications are not yet available. Structured workspace data and compressed workspace snapshots each have a 32 MiB limit; exceeding either reports a save failure.

Bibo supports Exa web search. Ask “Search for the latest official Cloudflare AI Search documentation and include source links.” No search key is needed. Bibo answers from relevant excerpts and links its sources; open those links to check important facts. Search queries are sent to Exa; the complete conversation is not sent to the search service.

Search is capped at 100 requests per account per UTC day, 1,000 service-wide per day, and 10,000 service-wide per UTC month, with up to 10 results per search. One question may need multiple searches, and failed upstream attempts consume the allowance. A search task usually makes a model call before the tool and another after its results; both count against the model allowance. Bibo explains when search fails or runs out of quota.

The initial limit is 100 requests per hour and 4,000 characters per request, with 250 model calls per account per day and 2,000 model calls across the service per day. Account authentication uses the NextClaw platform; Bibo provides a separate, capped model trial. When the trial quota is exhausted, Bibo reports it before sending; a new conversation does not gain an empty session, and the input remains available to retry later. Background scheduled work and proactive notifications are not available yet. Check important results before relying on them.

See [Bibo help](https://app.bibo.bot/help.html) for usage and data details. The local-first NextClaw workspace remains available through the [installation guide](/en/guide/install).

“New conversation” opens a blank page without adding an empty session to the list. A session is created when you send the first message. Use the session menu to rename or delete it. The bottom-left account menu groups help, sign-out, and reset actions; desktop sidebar controls stay at the top. File, note, and project creation and file renaming use dialogs that retain your input and show errors when saving fails. Mobile navigation opens in a side sheet.
