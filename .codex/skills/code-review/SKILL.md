---
name: code-review
description: Review code, diffs, pull requests, or proposed fixes for bugs, regressions, behavior risks, missing test coverage, and maintainability drift. Use when the user asks for a code review, PR review, risk scan, findings-first audit, or wants feedback on whether a fix is safe and appropriately simplified.
---

# Code Review

## Overview

Use this skill to review changes with a bug-finding mindset.

Optimize for correctness, regression detection, contract clarity, and maintainability pressure instead of style-only commentary.

## Workflow

1. Establish the scope.
   Identify the diff, touched files, adjacent contracts, and affected tests.
2. Reconstruct behavior.
   Determine what the code did before, what it does after, and what a real caller or user now observes.
3. Check high-risk surfaces first.
   Review correctness, edge cases, state transitions, async behavior, data flow, API or UI contract changes, and operational failure modes.
4. Check tests against external contracts.
   Look for missing coverage only when a real regression path or user-visible contract is left unprotected.
5. Apply simplification pressure.
   Before recommending a fix, ask whether the problem should be solved by deletion or simplification rather than another layer of logic.
6. Produce findings-first output.
   List findings ordered by severity with concrete file references, the risk, and the smallest credible fix direction.
7. End with uncertainty, not fluff.
   After findings, note open questions or assumptions, then give a brief summary only if it adds value.

## Review Questions

- What can break for a real user, caller, or operator?
- Which state transition, branch, or input now violates the intended contract?
- Does the change create duplicate logic or multiple sources of truth?
- Does it add hidden fallback behavior that masks a deeper defect?
- Are tests protecting stable behavior or only pinning implementation details?
- Would deletion or path unification solve the issue more safely than another branch, flag, or adapter?

## Review Rules

- Findings first. Summaries are secondary.
- Distinguish confirmed findings from assumptions and follow-up questions.
- Prioritize correctness, regressions, data loss, security/privacy exposure, and operational failure over style nits.
- Cite concrete file references for every finding when possible.
- Prefer external-contract reasoning over internal implementation preference.
- Flag missing tests only when an external contract or high-risk regression lacks protection.
- `delete-simplify-before-add`: when reviewing a change or a proposed fix, first ask whether the problem can be solved by deleting code, deleting a branch, or removing a compatibility path; if not, ask whether multiple paths can be simplified into one explicit path; only after both fail should you recommend adding new logic. Treat “just add another flag/branch/fallback” as a last resort.
- If no findings remain, state that explicitly and mention residual risks or validation gaps.

## Output Requirements

When using this skill, structure the response in this order:

1. Findings ordered by severity, each with file reference, risk, and reasoning.
2. Open questions or assumptions.
3. Brief change summary, or an explicit `no findings` conclusion with residual risks.
