# @nextclaw/bibo-hosted

## 0.1.0

### Minor Changes

- f7b646a: Add a personal workspace with separate conversations, an attention inbox, month/week/day calendar, project tasks, notes, and tabbed files. Notes and Agent-created artifacts share the same files, with version checks and draft-preserving save recovery.

  Unify menus, dialogs, navigation, and action feedback across desktop and mobile. New conversations are created only when the first message is sent. Add a public session deletion operation so deleting a hosted conversation also removes its underlying Agent journal.

  Keep long conversation titles within the toolbar without hiding actions, and constrain long item names across overview cards, task lists, inbox, and notes on narrow screens.

  Correct file-tree keyboard navigation at root and empty-folder boundaries, preserve a keyboard entry after deleting a node, and reveal the active tab when many files are open.

  Restore the chat workspace selection after refresh, preserve close and selection intent during slow reads, and show recoverable file errors inside the workspace.

  Keep missing conversation links identifiable, return a not-found response for deleted history, and avoid silently switching to another conversation.

  Prevent mobile navigation drawers from opening icon tooltips on automatic focus, while preserving keyboard focus and Escape behavior.

  Improve shared Markdown reading in chat, inbox, and file previews with code highlighting and copying, math, Mermaid diagrams, safe image fallback, and consistent small-screen layout.

### Patch Changes

- 091af2b: Make the empty area of each calendar month cell select its date while keeping event items independently clickable.
- b18b88b: Improve the file tree with consistent type icons, explicit empty-folder states, and retryable read and search failures.
- e053638: Keep inbox context when a referenced task, event, or file is unavailable, and open valid sources after a single detail read.
- 163f1db: Keep task and inbox pagination controls inside their independently scrolling lists.
- 55af90a: Improve Bibo Markdown readability during generation and after saving, use a compact reading layout and readable list excerpts in the inbox, and add a one-command local frontend preview with hot updates and streamed sample replies.

  Use an opaque, compact down-arrow button to return to the latest chat message.

  Unify composer send, stop, and waiting controls; allow drafting during generation and preserve both failed messages and new drafts during retry.

  Centralize section and conversation navigation with React Router, preserve per-conversation drafts across navigation, and make browser history and direct conversation links consistent.

- dd52bd6: Prevent the mobile navigation drawer from showing a new-conversation tooltip in hybrid touch and pointer environments. Tighten the drawer layout while retaining 44px touch targets and an accessible title. Remove redundant composer and empty-state hints, and keep the file editor controls visible at narrow desktop widths.
- 219a6fa: Report exhausted Bibo model quota before starting a chat request, preserving the draft and avoiding an empty new conversation.
- 54d5fcf: Show notes by most recent edit across the complete file space and place pagination controls inside the file and note lists.
- 0337c3b: Make the overview denser with a compact priority brief, independent content columns, and clearer mobile reading order.
- a09d863: Show retryable page errors instead of empty data when overview, inbox, tasks, or calendar reads fail.
- 3be19dc: Improve Bibo hosted chat with direct answer streaming from the first visible model tokens, stable conversation scrolling, explicit save and retry states, and a React/TypeScript component system.
- e721420: Show project and status in task rows and use the shared accessible icon action for deleting subtasks.
- 500a925: Prevent icon tooltips from appearing over the mobile navigation drawer on touch devices.
- 24336ee: 为各工作模块采用独立路径路由，优化任务快速创建、直接完成与撤销、截止时间筛选，手机月历与当天安排、笔记名称搜索和收件箱筛选；文件编辑支持键盘保存。
  - @nextclaw/harness@0.2.26

## 0.0.2

### Patch Changes

- 85bab59: 新增基于 NextClaw Agent 内核的 Bibo 独立网页服务，支持邮箱注册、持续对话和个人空间保存，并提供有每日上限的免费模型试用。
  - @nextclaw/harness@0.2.25
