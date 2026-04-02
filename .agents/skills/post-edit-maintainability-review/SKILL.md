---
name: post-edit-maintainability-review
description: Use when code changes are finished and a second-pass maintainability review is needed beyond lint or guard output, especially to judge deletion opportunities, simplification chances, abstraction fit, or whether non-feature changes added unjustified code
---

# Post Edit Maintainability Review

## Overview

Use this after implementation is done and after `post-edit-maintainability-guard`.

The goal is not to ask “did the code pass the guard?” but “did this change actually move the codebase toward less code, less branching, clearer ownership, and lower long-term maintenance cost?”

## When To Use

- Source, script, test, or runtime-path config changed
- Guard passed, but non-metric maintainability still needs judgment
- A non-feature change added code and you need to decide whether that growth is truly necessary
- A change may have hidden duplication, extra indirection, patch-style abstraction, or complexity moved elsewhere

Do not use for pure docs, wording tweaks, or trivial metadata edits.

## Review Questions

Answer these in order:

1. What can still be deleted?
2. What cannot be deleted but can still be simplified?
3. Did this change reduce or at least avoid worsening total code, branches, functions, files, and directory sprawl?
4. If this is not a new user-facing capability, why did the code grow, and is that growth the minimum necessary?
5. Are class / helper / service / store / controller boundaries clearer now, or did the change add another layer without reducing real complexity?
6. Did the change truly simplify the system, or did it just move complexity to another file, helper, or abstraction?
7. Did the change duplicate existing logic or an existing component surface that should have been reused or factored into a stable shared core?

## Output

Use a findings-first format focused on maintainability only.

- `可维护性复核结论：通过 / 需继续修改 / 保留债务经说明接受`
- `本次顺手减债：是/否`
- `可维护性总结：...`

If issues exist, list:

1. The maintainability finding
2. Why it hurts long-term maintenance
3. The smaller / simpler fix direction

If there are no issues, explicitly write:

- `no maintainability findings`

Then add a short maintainability summary in 1-3 sentences covering:

- whether the change made the code smaller, simpler, or clearer,
- whether any debt was intentionally kept,
- and the next seam or watchpoint if debt remains.

## Common Mistakes

- Repeating guard output instead of doing an actual second-pass review
- Treating `lint passed` as proof that the structure is already good enough
- Accepting code growth in a non-feature change without explaining why deletion or simplification was insufficient
- Calling something “refactored” when complexity was only renamed or moved
- Copying an existing helper or component with minor edits instead of reusing it or extracting a shared core
- Ending the task without a concise maintainability summary in the final reply
