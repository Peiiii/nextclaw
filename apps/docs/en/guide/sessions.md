# Session management

Sessions keep a task's goal, messages, tool activity, working directory, and results. The full guide now lives at [Tasks and sessions](/en/guide/chat).

Session history is kept locally in the journal and SQLite session catalog. During an upgrade, NextClaw rebuilds the catalog from existing journals and metadata, so sessions whose legacy list entry was incomplete can return automatically without a manual import.

You may also need:

- [Create your first task](/en/guide/create-task)
- [Session workspace](/en/guide/workspace)
- [Inspect task results](/en/guide/results)
