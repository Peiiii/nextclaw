# Chat Session Workspace Sidebar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the chat right sidebar from a child-session-only panel into a session-scoped workspace that can host child sessions plus opened files, while keeping the inner interaction model close to lightweight editor tabs: a top tab strip with content below.

**Architecture:** Keep the session page as the single workspace entry, but replace the dedicated child-session detail panel with a session workspace panel that still lives on the right side while using a top tab strip instead of a left navigator. Reuse the existing structured file-operation view model for tool-card-driven diff opening, add an explicit local-file open action for markdown/tool paths, and add one small server API for reading text file previews relative to the current session project root. `diff` and `preview` are separate open types rather than toggles inside one file view.

**Tech Stack:** React, Zustand, existing `NcpChatThreadManager`, Hono UI routes, TypeScript, Vitest, shared `@nextclaw/agent-chat-ui` message rendering primitives.

---

### Task 1: Define the workspace panel state model

**Files:**
- Modify: `packages/nextclaw-ui/src/components/chat/stores/chat-thread.store.ts`
- Modify: `packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-thread.manager.ts`
- Test: `packages/nextclaw-ui/src/components/chat/ncp/tests/ncp-chat-thread.manager.test.ts`

**Steps:**
1. Replace the child-session-only active panel state with a generic session workspace sidebar state.
2. Add opened file tab state that is scoped to a parent session and stores preview/diff metadata.
3. Keep the manager as the owner for open/select/close/upsert behavior so the sidebar stays predictable.
4. Add tests for opening child-session items, opening file items, deduping repeated file opens, and closing the workspace sidebar.

### Task 2: Extend chat message rendering with explicit file-open actions

**Files:**
- Modify: `packages/nextclaw-agent-chat-ui/src/components/chat/view-models/chat-ui.types.ts`
- Modify: `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.tsx`
- Modify: `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message.tsx`
- Modify: `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-markdown.tsx`
- Modify: `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/tool-card/tool-card-file-operation.tsx`
- Modify: `packages/nextclaw-agent-chat-ui/src/components/chat/index.ts`
- Test: `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/__tests__/chat-message-list.file-operation.test.tsx`
- Test: `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`

**Steps:**
1. Add a shared file-open action view model that can represent preview opens from markdown links and diff opens from tool cards.
2. Thread an optional `onFileOpen` callback through the shared chat message list.
3. Make file paths inside file-operation cards visibly clickable, truncated, and tooltip-backed.
4. Intercept local-file markdown links explicitly instead of relying on global DOM interception.
5. Add focused tests for tool-card path clicks, local markdown file link clicks, and non-local links falling back to normal anchors.

### Task 3: Preserve enough file-operation source data for full sidebar diff rendering

**Files:**
- Modify: `packages/nextclaw-ui/src/components/chat/adapters/file-operation/diff.ts`
- Modify: `packages/nextclaw-ui/src/components/chat/adapters/file-operation/card.ts`
- Modify: `packages/nextclaw-ui/src/components/chat/adapters/chat-message-part.adapter.ts`
- Test: `packages/nextclaw-ui/src/components/chat/adapters/chat-message.adapter.test.ts`

**Steps:**
1. Keep the card preview blocks lightweight for inline rendering, but preserve full diff/preview source metadata needed by the sidebar.
2. Build one file-open action per rendered file path so the workspace sidebar can open the matching file directly.
3. Ensure `read_file`, `write_file`, `edit_file`, `apply_patch`, and `file_change` all produce sidebar-openable file targets.
4. Add adapter tests covering preview-only opens and diff-capable opens.

### Task 4: Add a server-backed text file preview API

**Files:**
- Modify: `packages/nextclaw-server/src/ui/types.ts`
- Modify: `packages/nextclaw-server/src/ui/router.ts`
- Modify: `packages/nextclaw-server/src/ui/ui-routes/server-path.controller.ts`
- Create: `packages/nextclaw-server/src/ui/server-path/server-path-read.utils.ts`
- Modify: `packages/nextclaw-server/src/ui/ui-routes/server-path.controller.test.ts`
- Modify: `packages/nextclaw-ui/src/api/types.ts`
- Modify: `packages/nextclaw-ui/src/api/server-path.ts`
- Create: `packages/nextclaw-ui/src/hooks/server-path/use-server-path-read.ts`

**Steps:**
1. Add a read endpoint that resolves an input path relative to an optional base path.
2. Return structured preview metadata for text/markdown vs unsupported/binary files.
3. Cap preview size and expose truncation metadata so the UI stays responsive.
4. Add route tests for absolute path, relative path with base path, missing file, and non-text file handling.

### Task 5: Replace the child-session panel with a top-tab workspace sidebar

**Files:**
- Modify: `packages/nextclaw-ui/src/components/chat/chat-conversation-panel.tsx`
- Modify or replace: `packages/nextclaw-ui/src/components/chat/chat-child-session-panel.tsx`
- Create: `packages/nextclaw-ui/src/components/chat/chat-session-workspace-panel.tsx`
- Create: `packages/nextclaw-ui/src/components/chat/chat-session-workspace-file-preview.tsx`
- Modify: `packages/nextclaw-ui/src/components/chat/containers/chat-message-list.container.tsx`
- Test: `packages/nextclaw-ui/src/components/chat/chat-conversation-panel.test.tsx`
- Test: `packages/nextclaw-ui/src/components/chat/containers/chat-message-list.container.test.tsx`

**Steps:**
1. Swap the current panel shell for a single-column workspace layout: top tab strip, content below.
2. Keep child sessions and opened files in one unified tab rail, with child sessions first and file tabs after them.
3. Render child session content as before, but render file items with fixed content semantics in the same workspace shell: markdown/file-link opens show preview only, tool-card opens show diff only.
4. Constrain tab widths, default file tabs to filename-only labels, and show full labels/paths on hover.
5. Cover empty state, child session selection, file selection, preview rendering, diff rendering, and same-file preview/diff coexistence in tests.

### Task 6: Validate and document the iteration

**Files:**
- Modify: `docs/logs/<iteration>/README.md` or create the next valid iteration directory if this crosses into a new batch

**Steps:**
1. Run the smallest sufficient targeted tests for shared UI, adapter, manager, server route, and chat page panel behavior.
2. Run `pnpm lint:maintainability:guard` plus targeted `tsc`/Vitest scopes affected by the change.
3. Perform an explicit maintainability pass focused on “one workspace sidebar instead of multiple hidden side channels”.
4. Update the iteration log with validation, acceptance, release notes, and maintainability summary.
