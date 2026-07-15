# Build a Small Local App

When a job repeats, ask NextClaw to turn it into a script, HTML page, or Panel App. Examples include a CSV merger, image compressor, cost calculator, personal dashboard, or document search page.

## Prepare before you start

- Define the one problem the tool must solve.
- Provide one or two realistic inputs and the expected output.
- State the runtime, storage needs, and directories that may be changed.
- Keep authentication, sync, permissions, and a complex backend out of the first version unless they are essential.

## Example prompt

<div class="nc-task-prompt">
  <p>Build a local CSV merge tool in the current working directory. Let the user choose several CSV files with matching columns, preview file names and row counts, confirm, then merge and download the result. Start with a version that needs no login or server. Generate runnable code and open the page in the right-side workspace for review.</p>
</div>

## Recommended workflow

### 1. Confirm the smallest useful version

Ask NextClaw to restate the input, core action, output, and features that will not be built yet. Approve that scope before implementation.

### 2. Generate and run it

Keep the code in its own directory and document how to start it. Preview the page beside the conversation and switch to the source files when needed.

![An interactive piano Panel App running inside a NextClaw conversation](/product-screenshots/nextclaw-panel-app-running-en.png)

### 3. Test with realistic samples

Cover a normal file, empty file, mismatched columns, and a duplicate selection. Do more than check that the page opens.

### 4. Fix one class of problem at a time

Correct behavior first, then refine layout and details. Describe the control and exact symptom instead of saying only that the result feels wrong.

## Result checklist

- A new user can complete the core action without reading the source.
- Invalid input produces a clear message and does not damage source files.
- Refresh and reopen behavior matches the storage requirement.
- The directory contains startup and dependency instructions.
- The final output downloads or saves to a clear location.

## Continue from here

After the first version is stable, consider search, batch processing, automation triggers, messaging input, or packaging the workflow as a Skill. Add one capability at a time and keep a working version.

Related: [Chat and Sessions](/en/guide/chat) · [Tools](/en/guide/tools) · [Skills](/en/guide/tutorials/skills)
