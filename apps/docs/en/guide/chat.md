# Tasks and sessions

The More menu below a message opens run metadata and trigger details when those records are available. Its actions use the same icons, spacing, and highlight feedback as session, project, and other object menus. Closing a detail dialog returns focus to the original More button.


In the desktop sidebar, switch between Time and Project views at the top left of the conversation list. Click the search icon on the right to open a search field below the controls. Close it with the close button or Escape to clear the filter and hide the field. In Project view, Add Project appears immediately to the left of search.

A session is not merely chat history. It is the container where a task keeps its goal, messages, tool activity, working directory, file results, and follow-up changes.

In Time view, Pinned and date groups start expanded. Click a group heading to collapse or expand its sessions with the same transition as message details. The arrow on the right appears only while hovering over the heading. You can also focus the heading and press Enter or Space. Collapsing and expanding work on both desktop and phones.

## Start a new task when

On phones, your messages hide the user avatar to leave more room for content. Desktop messages keep the avatar.

- you move to another project or working directory;
- the new outcome is unrelated to the current material;
- you need another agent or runtime;
- an experiment should stay separate from long-running work.

Continue the current session when you are refining its files, asking more questions about the same sources, adding the next step, or relying on decisions already confirmed there.

Each session keeps its own unsent composer draft, so you can switch sessions or refresh and continue editing. After a message is sent successfully, the composer and its saved draft are cleared and the sent content does not return when you reopen the session. A failed send keeps the complete draft for editing or retrying.

## Processing details

After a reply ends, reasoning and tool activity can collapse into a “Processed” summary. Failed runs show “Failed”; runs with a recorded stop show “Stopped”. The summary shows only status and recorded elapsed time, such as “Processed 2m 7s”, without tool counts or tool names. Click it to expand processing details. When the run records its start and end times, elapsed time remains available after a refresh. Older messages without timing records do not show an estimated duration.

The thinking indicator follows the current task. A task may continue after a reply appears; the generation indicator ends when the task reports completion.

## Reading position after sending

When you send at or near the bottom of a conversation, your new message moves toward the top of the reading area, leaving room for the AI reply. The reply fills this space before the page follows longer output. Any remaining space stays after a short reply finishes, preventing a jump.

If you are browsing earlier messages, sending a message and receiving output keep your reading position. Scrolling up during a reply also pauses following; use the return-to-bottom button to see the latest content again.

The down arrow appears only when message content extends below the visible area. It stays hidden when the latest content is visible and only reserved space remains below. Pausing automatic following by expanding details does not by itself show the arrow.

Processed summaries, reasoning, tool groups, and tool details share a smooth expand/collapse transition. Repeated clicks reverse from the current height. The transition is skipped when your system requests reduced motion.

Nested details that are already open appear directly within the parent transition. Content changes during that transition do not repeatedly extend the animation.

Expanding content pauses automatic following and preserves your reading position through detail loading and further output. Scroll near the bottom or use the return-to-bottom button to resume following. Expanded tool groups occupy at most about half the screen and scroll internally when longer. Faded edges indicate more content in that direction and disappear when you reach the edge.

Expanding a completed process immediately shows a spinner and skeleton placeholders while its details load. You can collapse it while waiting; completion will not reopen it. If loading fails, click the retry message to load the details again.

## Voice input

When recording starts, the overlay explains why microphone access is needed. Choose Allow in the browser permission prompt. If access is denied, the overlay shows site permission instructions and the settings path for your operating system. After changing permissions, select **Check microphone and retry**. The check immediately releases its temporary microphone capture before starting speech recognition. Missing or unreadable devices have separate messages. Save your draft before restarting the app if your system requires it.

Both first use and retries check the microphone first. Waiting for your permission choice is not interrupted by the prompt taking focus or counted toward the speech-service connection timeout. Leaving the page or choosing Save and close still ends the request; granting permission afterward will not start recording automatically.

Startup, recording, and finalization share one compact bar, labeled Preparing, Listening, and Finishing respectively. State changes keep the bar's dimensions stable without flashing a larger panel first. Hover over the startup status for the microphone purpose explanation. Instructions expand only when an error needs attention.

Browsers cannot always distinguish a site-level denial from a system-level denial, so the instructions cover both settings. A disabled speech recognition service is reported separately.

Browsers expose microphone access only in a secure context. Use HTTPS for a remote VPS. When NextClaw is opened directly at `http://<VPS-IP>`, it reports the insecure address instead of claiming that the browser lacks voice support. The `http://localhost` and `http://127.0.0.1` exceptions apply only to local access on the same machine and do not replace remote HTTPS.

Click the microphone beside the composer to record, then press Esc or choose **Save and close**. Words appear at the cursor or selection captured when recording starts. Underlined words are provisional and may change; the underline disappears when transcription finishes. The overlay shows recording status and duration, without a discard button; the Esc shortcut appears only in the save button's tooltip. Saving waits for the final words; if finalization fails, the words already displayed are retained. Nothing is sent automatically; surrounding text, references, and attachments stay intact. Each recording is limited to 60 seconds.

Typing, pasting, or moving the cursor inside the composer ends dictation and keeps the visible words so you can edit. Late recognition results cannot overwrite your edits. During dictation, Enter ends dictation without sending; Esc saves and closes dictation.

On desktop layouts, configure hold-to-talk in **Settings → Keyboard shortcuts → Voice input**. The gear at the right of the recording overlay opens the same settings. Opening settings finishes the current transcription first; closing settings does not restart recording. Bind, change, or disable the shortcut there. Release the key to finish. Single letters and F6–F10 only trigger outside text inputs; combinations using Ctrl or ⌘ with Alt/⌥ also work inside. Standard editing shortcuts and IME composition are protected. Phones use the microphone button without shortcut settings. System-reserved keys may not reach the page.

Switching conversations cancels recording. Losing window focus or hiding the page stops capture. Permission, network, and device errors appear beside the input; confirmed text remains in your draft and provisional words are removed. Your browser's speech service may process audio online. Offline recognition is not guaranteed, and availability depends on the browser, system, and service.

## Session types

NextClaw can host Native, Codex, Claude Code, Weixin, Feishu, and scheduled-task entry points. Their tools and interaction details differ, but each should begin with a clear outcome, working directory, and inspectable result.

## Session list

Name work so it is recognizable later. Prefer names such as “July sales analysis” or “Release verification” over a list of sessions called “Hello” or “Test.”

New sessions initially show a short excerpt of the first message. As soon as the user message is saved, NextClaw starts generating a concise title in the background with the model selected for that turn; it does not wait for the main reply to finish. The title request runs alongside the reply. Specific work is summarized by topic; greetings and simple small talk are named by interaction type, such as “Casual greeting,” instead of repeating the opening words. The list updates automatically, and the title survives a refresh. Failed title requests keep the temporary title without interrupting chat. Generated titles stay stable, and manual names are never overwritten. Some older versions incorrectly marked temporary titles as manual; those historical names are not overwritten in bulk.

On desktop, hover over a session to see its project, child-session count, and scheduled-task count. Hover over a project to see its path, session count, and related scheduled tasks. Project rows keep the default view minimal; the expand indicator and actions appear on hover.

Running child sessions show a spinner in the session workspace. Child-session management identifies each active session, while the overview and the top-level **Child sessions** tab show the same indicator whenever any child session is running, so you do not need to open each one to check.

The workspace overview groups project files, scheduled tasks, child sessions, and continuous attention, in that order, on a subtle themed surface with row dividers. A separate usage section shows compact two-column metrics and individually grouped model details. The file explorer shares the overview's theme background.

## Copy a session ID

Open **More actions** in the current session header, a session in the session list, a child session in the session workspace, or a child-session tab, then choose **Copy session ID**. This copies the complete ID for that session. Draft sessions do not have a stable ID yet, so this action is not shown for them.

## Tool activity after refreshing

Multiple rounds of tool calls remain part of the same reply. Refreshing or reopening a session does not execute the tools again, and loading a completed reply does not add another message showing tools as still running.

## Add files and selected text to a message

Type `@` to reference a file, folder, project, or Panel App. You can also open a file in the session workspace and choose **Add to chat** from its action menu. In a text file, select a passage first when only that excerpt should be included.

References appear in the composer and are sent with the current message. They tell the agent exactly which material to use and retain a link back to the source. A folder reference defines a search scope for the task; it does not insert the entire folder into one message.

## Edit and rerun

If the latest request has a mistake or is missing a file or constraint, choose **Edit message** on the latest editable user message. After you update and send it, NextClaw reruns from that message instead of appending the change as a new follow-up.

Use edit and rerun to correct the current branch. Send a normal new message when you want to build on the result that is already there.

## Continue an interrupted run

When a task is stopped, interrupted, or fails, a recoverable assistant reply shows **Continue**. NextClaw resumes the same task in the original reply position, so you do not need to copy the previous request or create an unrelated reply.

Continue is available only for cancelled or failed tasks that the current runtime can resume. It is not shown while a task is still running.

## Send another message while AI is running

When AI is replying, a normally sent message waits in the queue and runs after the current task. Queued messages appear above the composer, where you can edit, delete, or insert them into the current task.

Press `Command + Enter` on macOS or `Ctrl + Enter` on Windows and Linux to insert the current draft at the next safe step. A direct keyboard insertion and a queued message inserted later use the same pending message display and preserve their text, attachments, and references. The output already being generated is not cut off, and you can inspect the run source from **More actions** after the message completes.

## Inspect what started a run

Open **More actions** on a message to inspect who started the run, its entry point, source session and message, source model, model used for this run, tool call, target run ID, and retained identifiers for a channel, scheduled job, or observation. Assistant messages also show token usage and outcome so you can connect the trigger to its result.

## Inspect session token usage

Open the session workspace to see recorded Agent rounds, model calls, calls with reported usage, and input, output, cached-input, and total tokens. The per-model breakdown shows the rounds and calls for each model, so you can tell whether a task completed in a few long calls or through multiple tool loops.

Cache read ratio uses input tokens only: cached-read tokens divided by all input tokens. Output tokens are shown separately and do not affect the ratio. The ratio appears only when the model reports cache usage.

Global completion notifications are reserved for background replies started directly by a person. Agent delegation, scheduled jobs, observations, and other automated runs remain available in their sessions without an extra completion notification.

## Long tasks and context compaction

Native Agents automatically compact earlier content when a long task approaches its context limit, then continue within the same task. The timeline shows when compaction starts and completes. The resulting context keeps a summary plus recent user messages so the resumed model can stay focused on the current request.

The context-window indicator separates system and tools, conversation content, output reserve, and the automatic compaction threshold. Its percentage estimates the complete model input, not only the visible chat messages.

You can also use `/compact` to compact earlier context on demand. For both automatic and manual compaction, keep critical paths, final criteria, and non-editable boundaries explicit near the work that depends on them.

## Math formulas

Chat messages and Markdown files in the session workspace support `$...$`, `$$...$$`, inline `\(...\)` and display `\[...\]`. For example, use `\(E = mc^2\)` inline, or:

```text
\[
\frac{1}{2}
\]
```

Chat messages support LaTeX math. Use `$E = mc^2$` for inline formulas. For a display formula, put `$$` on separate lines before and after it:

```text
$$
\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$
```

Fractions, roots, sums, integrals, matrices, and other KaTeX syntax are supported. Wide display formulas scroll horizontally. During generation, unfinished `$$` display formulas show an ellipsis until their closing delimiter arrives. Backslash-delimited and inline formulas remain plain text until closed. Temporary parsing errors do not flash red; closed formulas that remain invalid show an error marker once generation ends. Inline code and ordinary code blocks preserve their literal text. Escape dollar signs as `\$`.

Inside a session you can open the [workspace](/en/guide/workspace), create subtasks, add a scheduled job, or reference a Panel App or skill.
