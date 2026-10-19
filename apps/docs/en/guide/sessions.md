# Session management

Sessions keep a task's goal, messages, tool activity, working directory, and results. The full guide now lives at [Tasks and sessions](/en/guide/chat).

The native runtime temporarily appends the current UTC time, host timezone, and UTC offset to the end of each model request. Ordinary conversation, follow-up calls after tools, and runtime retries all refresh this time context. It is not saved in chat records or conversation history and does not rewrite the preceding stable context. The host timezone may differ from your own.

Session history is kept locally in the journal and SQLite session catalog. During an upgrade, NextClaw rebuilds the catalog from existing journals and metadata, so sessions whose legacy list entry was incomplete can return automatically without a manual import.

When the catalog is large, the sidebar places pinned sessions first, then orders by activity time and preloads the next page near the end of the list. Pins, search, ordering, and totals are handled by the local catalog, so older sessions remain browsable and searchable.

Switch to Scheduled view to see conversations created by scheduled tasks. Filtering happens before pagination, and search and pins remain available. Tasks bound to an existing ordinary conversation keep its original classification. See [Tasks and sessions](/en/guide/chat) for the complete workflow.

Large histories load a bounded page rather than the entire conversation. If a history index needs rebuilding, the conversation shows preparation progress. You can stop preparation and retry later; the original journal stays available. Large messages show a preview with an option to read their original content one fragment at a time.

Context summaries can fail or end early. When the existing context still fits, NextClaw defers compaction. When it must reduce context, it saves a recovery checkpoint and keeps the original history. During recovery, the agent can read this conversation's history and ask for missing business conditions. It cannot run other tools until you explicitly confirm those conditions. For a channel conversation, answer the pending clarification with `确认续做：` followed by the concrete conditions; an ordinary message or the agent claiming completion does not clear recovery.

You may also need:

- [Create your first task](/en/guide/create-task)
- [Session workspace](/en/guide/workspace)
- [Inspect task results](/en/guide/results)
