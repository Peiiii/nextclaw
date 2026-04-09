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
3. What is the diff-level line-change report for this change:
   - total added lines / deleted lines / net lines,
   - non-test added lines / deleted lines / net lines after excluding tests?
4. Did this change reduce or at least avoid worsening total code, branches, functions, files, and directory sprawl?
5. If total or non-test code grew, has the implementation already reached the best practical reduction point, or can more code still be deleted, merged, or collapsed?
6. If this is not a new user-facing capability, why did the code grow, and is that growth the minimum necessary?
7. Are class / helper / service / store / controller boundaries clearer now, or did the change add another layer without reducing real complexity?
8. Did the change truly simplify the system, or did it just move complexity to another file, helper, or abstraction?
9. Did the change duplicate existing logic or an existing component surface that should have been reused or factored into a stable shared core?
10. If React code was touched, are `useEffect` / `useLayoutEffect` still limited to external-system sync, or is business coordination still leaking through effects instead of store / manager / presenter / query-view ownership?

## Output

Use a findings-first format focused on maintainability only.

- `可维护性复核结论：通过 / 需继续修改 / 保留债务经说明接受`
- `本次顺手减债：是/否`
- `代码增减报告：`
- `非测试代码增减报告：`
- `可维护性总结：...`

For the two line-change reports, always include:

- `新增：<N> 行`
- `删除：<N> 行`
- `净增：<+/-N> 行`

`非测试代码增减报告` must exclude typical test files and test-only directories, including patterns such as:

- `*.test.*`
- `*.spec.*`
- `__tests__/`
- `tests/`

If total or non-test code is net positive, you must explicitly explain:

- whether the change has already reached the best practical minimum,
- what was deleted or simplified before accepting the growth,
- and why the remaining growth is still the minimum necessary.

If issues exist, list:

1. The maintainability finding
2. Why it hurts long-term maintenance
3. The smaller / simpler fix direction

If there are no issues, explicitly write:

- `no maintainability findings`

Then add a short maintainability summary in 1-3 sentences covering:

- whether the change made the code smaller, simpler, or clearer,
- whether any debt was intentionally kept,
- whether net code growth was truly minimized,
- and the next seam or watchpoint if debt remains.

## Common Mistakes

- Repeating guard output instead of doing an actual second-pass review
- Omitting the line-change report or only reporting total diff without separating non-test code
- Treating `lint passed` as proof that the structure is already good enough
- Accepting code growth in a non-feature change without explaining why deletion or simplification was insufficient
- Calling something “refactored” when complexity was only renamed or moved
- Copying an existing helper or component with minor edits instead of reusing it or extracting a shared core
- Leaving business coordination in React effects while only renaming nearby helpers or moving setters to a different file
- Ending the task without a concise maintainability summary in the final reply
