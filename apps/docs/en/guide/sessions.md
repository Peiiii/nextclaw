# Session management

Sessions keep a task's goal, messages, tool activity, working directory, and results. The full guide now lives at [Tasks and sessions](/en/guide/chat).

The native runtime temporarily appends the current UTC time, host timezone, and UTC offset to the end of each model request. Ordinary conversation, follow-up calls after tools, and runtime retries all refresh this time context. It is not saved in chat records or conversation history and does not rewrite the preceding stable context. The host timezone may differ from your own.

Session history is kept locally in the journal and SQLite session catalog. During an upgrade, NextClaw rebuilds the catalog from existing journals and metadata, so sessions whose legacy list entry was incomplete can return automatically without a manual import.

When the catalog is large, the sidebar places pinned sessions first, then orders by activity time and preloads the next page near the end of the list. Pins, search, ordering, and totals are handled by the local catalog, so older sessions remain browsable and searchable.

Switch to Scheduled view to see conversations created by scheduled tasks. Filtering happens before pagination, and search and pins remain available. Tasks bound to an existing ordinary conversation keep its original classification. See [Tasks and sessions](/en/guide/chat) for the complete workflow.

You may also need:

- [Create your first task](/en/guide/create-task)
- [Session workspace](/en/guide/workspace)
- [Inspect task results](/en/guide/results)
