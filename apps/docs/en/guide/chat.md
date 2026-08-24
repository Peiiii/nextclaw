# Tasks and sessions

A session is not merely chat history. It is the container where a task keeps its goal, messages, tool activity, working directory, file results, and follow-up changes.

## Start a new task when

- you move to another project or working directory;
- the new outcome is unrelated to the current material;
- you need another agent or runtime;
- an experiment should stay separate from long-running work.

Continue the current session when you are refining its files, asking more questions about the same sources, adding the next step, or relying on decisions already confirmed there.

## Session types

NextClaw can host Native, Codex, Claude Code, Weixin, Feishu, and scheduled-task entry points. Their tools and interaction details differ, but each should begin with a clear outcome, working directory, and inspectable result.

## Session list

Name work so it is recognizable later. Prefer names such as “July sales analysis” or “Release verification” over a list of sessions called “Hello” or “Test.”

## Copy a session ID

Open **More actions** in the current session header, a session in the session list, a child session in the session workspace, or a child-session tab, then choose **Copy session ID**. This copies the complete ID for that session. Draft sessions do not have a stable ID yet, so this action is not shown for them.

## Add files and selected text to a message

Type `@` to reference a file, folder, project, or Panel App. You can also open a file in the session workspace and choose **Add to chat** from its action menu. In a text file, select a passage first when only that excerpt should be included.

References appear in the composer and are sent with the current message. They tell the agent exactly which material to use and retain a link back to the source. A folder reference defines a search scope for the task; it does not insert the entire folder into one message.

## Edit and rerun

If the latest request has a mistake or is missing a file or constraint, choose **Edit message** on the latest editable user message. After you update and send it, NextClaw reruns from that message instead of appending the change as a new follow-up.

Use edit and rerun to correct the current branch. Send a normal new message when you want to build on the result that is already there.

## Continue an interrupted run

When a task is stopped, interrupted, or fails, a recoverable assistant reply shows **Continue**. NextClaw resumes the same task in the original reply position, so you do not need to copy the previous request or create an unrelated reply.

Continue is available only for cancelled or failed tasks that the current runtime can resume. It is not shown while a task is still running.

## Inspect what started a run

Open **More actions** on a message to inspect who started the run, its entry point, source session and message, source model, model used for this run, tool call, target run ID, and retained identifiers for a channel, scheduled job, or observation. Assistant messages also show token usage and outcome so you can connect the trigger to its result.

Global completion notifications are reserved for background replies started directly by a person. Agent delegation, scheduled jobs, observations, and other automated runs remain available in their sessions without an extra completion notification.

## Long tasks and context compaction

Native Agents automatically compact earlier content when a long task approaches its context limit, then continue within the same task. The timeline shows when compaction starts and completes. The resulting context keeps a summary plus recent user messages so the resumed model can stay focused on the current request.

The context-window indicator separates system and tools, conversation content, output reserve, and the automatic compaction threshold. Its percentage estimates the complete model input, not only the visible chat messages.

You can also use `/compact` to compact earlier context on demand. For both automatic and manual compaction, keep critical paths, final criteria, and non-editable boundaries explicit near the work that depends on them.

Inside a session you can open the [workspace](/en/guide/workspace), create subtasks, add a scheduled job, or reference a Panel App or skill.
