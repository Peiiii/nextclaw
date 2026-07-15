# Inspect and modify a codebase

With a repository as the working directory, NextClaw can understand the current system, reproduce a problem, change the implementation, run checks, and open the real page or output for verification.

## Prepare

- project directory and run commands;
- expected behavior, current symptom, and reproduction steps;
- protected modules and existing uncommitted changes;
- required tests, type checks, and browser verification;
- permission to install dependencies, use the network, or edit configuration.

## Example prompt

<div class="nc-task-prompt">
  <p>Reproduce the mobile table overflow in this project. Find the component and style that truly own the layout, and do not change unrelated pages. After the fix, run the type check and related tests, then open the page at 390 x 844 and confirm there is no horizontal scrolling. Do not commit.</p>
</div>

## What happens

1. The agent reads project instructions, worktree state, and relevant source.
2. It follows the reproduction steps and identifies the owner.
3. It makes a scoped change without overwriting user work.
4. It runs relevant tests, type checks, and builds.
5. It performs browser or runtime verification for visible behavior.

## Review the result

Confirm that the real reproduction is fixed, unrelated files were not changed, no duplicate or rescue path was added, all required checks ran, and the claimed result is visible in the actual product.
