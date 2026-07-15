# Create your first task

Do more than ask a trivia question. Choose real work with source material and an output you can inspect within a few minutes: summarize a spreadsheet, compare several pages, inspect a project, or generate a small webpage.

## 1. Start a new task

Select **New Task**, then choose a session type and working directory.

- Pick the relevant project directory for files, code, or app generation.
- Use the default workspace for temporary research or writing.
- Select a dedicated agent or runtime when the task requires one.

The working directory determines where the agent reads material and saves results. Avoid selecting a broad parent directory that contains unrelated or sensitive files.

## 2. Describe the complete job

A useful request usually includes four parts:

```text
Goal: what should be completed
Material: files, directories, links, or existing content
Output: document, table, image, code, or webpage
Boundaries: date range, format, overwrite policy, and acceptance criteria
```

For example:

<div class="nc-task-prompt">
  <p>Read the CSV files in sales-data, check missing and duplicate records, and summarize monthly revenue by product line. Create two charts and an HTML report with three evidence-backed conclusions. Do not change the source files. Save the result in analysis-output.</p>
</div>

## 3. Add source material

Refer to a local path, attach a file, paste links, or mention a Panel App. For a large set of material, ask the agent to inventory the files and sources before processing them.

## 4. Send and observe

Check the agent's understanding as soon as execution starts. Answer questions about metrics, formats, or permissions. Stop immediately if it selects the wrong directory or direction.

## What success looks like

- The agent used the correct material and directory.
- You can see the important actions it took.
- The result opens in the session or workspace.
- You can refine it without restarting from scratch.

Next: [follow agent progress](/en/guide/getting-started).
