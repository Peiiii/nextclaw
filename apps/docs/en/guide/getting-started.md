# Quickstart: complete an end-to-end task

This path takes about ten minutes and covers the complete NextClaw workflow: configure a model, choose a working directory, send a real task, observe execution, and open the final file.

## 1. Open NextClaw

Launch the desktop app after installation. For npm, run:

```bash
nextclaw start
```

Then open `http://127.0.0.1:55667`. Docker users should open the address configured during deployment.

If the interface does not load, run:

```bash
nextclaw status
nextclaw doctor
```

## 2. Configure one working model

Open Settings, choose a provider for which you have credentials, enter the authentication details, and select a default model. You can also use a local model or a custom OpenAI-compatible endpoint.

Start with one reliable path. See [Models and providers](/en/guide/model-selection) for the full set of options.

## 3. Create a task with a deliverable

Start a new task, choose a test directory, and place a short Markdown or text file inside it. Then send:

<div class="nc-task-prompt">
  <p>Read the material in the current directory, extract five key points and three action items, and save the result as summary.md. Keep the source files unchanged. When finished, tell me which files you read and open the final result.</p>
</div>

This verifies the model, file tools, working directory, and result preview together instead of testing only a greeting.

## 4. Observe and steer

Confirm that the agent reads only the test directory. Answer questions about scope or format, and stop it immediately if it selects the wrong file. Continue in the same session with a refinement such as:

```text
Format the action items as a table with owner, due date, and status.
```

## 5. Open the real result

Find `summary.md` in the right workspace. Check the content and verify that the source file was not changed. Ask for one more revision to confirm that the task preserves its current context.

## Quickstart completion criteria

- The interface opens reliably.
- One model can respond and use tools.
- The agent accesses only the selected working directory.
- `summary.md` exists locally and opens in the right workspace.
- A follow-up edit keeps the current task context.

Next, read [Create your first task](/en/guide/create-task), [Inspect task results](/en/guide/results), or pick a [task guide](/en/tasks/).
