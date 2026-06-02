---
name: nextclaw-agent-instructions-governance
description: Use when editing AGENTS.md, commands/commands.md, Rulebook or Project Rulebook content, project AI instructions, or deciding whether a rule belongs in AGENTS.md, a skill, or ordinary docs. Also use when the user says to remember a rule/principle/norm, or for /config-meta, /check-meta, /new-rule, and AGENTS token optimization.
---

# NextClaw Agent Instructions Governance

## Goal

Keep agent instructions reliable without turning `AGENTS.md` or skills into giant prompts.

Token budget is an explicit governance goal:

- Prefer deleting, merging, or moving details to lazy-loaded references before adding new instruction text.
- A skill should stay short enough to guide action; long examples, recovery maps, and logs belong in scripts or focused references.
- For long-running workflows, prefer compact automation and JSON summaries over transcript-scale manual polling.

Default structure:

- `AGENTS.md`: always-on kernel that every reply must know.
- `.agents/skills/*/SKILL.md`: scenario workflows that Codex can trigger by description.
- `docs/*`: human-facing or long-lived references, only authoritative when a skill or AGENTS explicitly points to them.

For the full governance-system map, use:

- `docs/internal/governance-system-sources-of-truth.md`

## Before Editing

1. Read `docs/VISION.md` enough to align with the product direction.
2. Inspect current `AGENTS.md` size with `wc -c -m -w AGENTS.md`.
3. Check worktree status and avoid overwriting unrelated user edits.
4. Identify the root problem before adding text:
   - missing always-on constraint,
   - unclear skill trigger,
   - repeated rule,
   - stale command index,
   - rule that belongs in a scenario skill,
   - ordinary documentation that should not be a hard rule.
5. Before changing any rule surface, choose the operation deliberately:
   - add a new rule only when no existing rule owns the concern,
   - merge when multiple rules describe the same concern,
   - delete when the rule is obsolete, duplicated, too specific, or only names a symptom,
   - rewrite or lift when a concrete rule should become a broader principle,
   - move when the rule belongs in another skill, AGENTS, command, script, or ordinary docs.
6. When the request changes project governance, inspect whether the change also touches:
   - `commands/commands.md`,
   - `scripts/governance/*`,
   - governance baseline / test files,
   - linked internal governance docs.

## Placement Decision

Use this decision order:

1. Put it in `AGENTS.md` only if every task and every reply must know it.
2. Put it in an existing skill if it is scenario-specific and that skill already owns the workflow.
3. Create a new skill if no existing skill has a clear trigger and the workflow is repeatable.
4. Put it in `docs/` only if it is human reference, design background, examples, or long-form context that does not need automatic enforcement.
5. Delete or merge it if it duplicates a stronger rule.

Do not move hard rules into ordinary docs unless a skill explicitly requires reading that doc at the right moment.

## AI-Readable Guide Structure

When updating AI-readable guides such as `USAGE.md`, avoid turning the top-level guide into a full reference dump.

- Keep the top-level guide as an index plus high-frequency rules the AI must see early.
- Move rarely needed payload contracts, long examples, parameter matrices, troubleshooting maps, and protocol details into focused linked files.
- Ensure packaged runtime resources include the linked detail files; do not link from a packaged guide to repo-only docs unless the package sync path copies them too.
- A detail page is appropriate when the AI only needs it after a specific intent is known, such as implementing a webhook caller or debugging one endpoint.

## Remember Requests

当用户说“记住”“以后都要”“这是规范/原则”时，不能只在回复里说已经记住。必须把它当成规则持久化请求处理：

1. 先判断它是不是每轮都必须知道；是则写入 `AGENTS.md` 的高层规则。
2. 如果只在特定场景需要，写入对应 skill，并确保 description 能触发。
3. 如果会影响自动检查，更新对应治理脚本或说明为什么暂不需要脚本。
4. 如果不应落盘，必须明确说明原因，而不是口头承诺。

## Governance System Scope

When users say "规范", "治理规则", "规则系统", "调整元规范", or similar, do not assume they only mean prose documents.

Treat the governance system as including at least:

- `AGENTS.md`
- `.agents/skills/*/SKILL.md`
- `commands/commands.md`
- relevant `docs/*` references
- `scripts/governance/*`
- related baselines, fixtures, and tests

If a rule change affects executable behavior, do not stop at text edits. Update the corresponding script surface in the same change, or explicitly state why it is not applicable.

The reverse direction is also mandatory:

- if a script/governance change introduces, removes, or relaxes a rule surface, do not stop at script edits;
- update the owning skill / command / governance doc in the same change, or explicitly state why no owner text exists;
- do not let executable governance drift ahead of the documented rule model.

## AGENTS.md Rewrite Rules

- Keep `AGENTS.md` concise and startup-oriented.
- Prefer one high-signal bullet over example + counterexample + process blocks.
- Preserve hard constraints for communication, git safety, validation, user-change protection, and skill routing.
- Remove repeated command details when a skill or command file owns them.
- Do not add a new top-level section unless it changes the kernel structure in a meaningful way.
- If adding a new scenario rule, first try to add it to the appropriate skill description/body.

## Skill Rules

When creating or updating a skill:

- 项目内 skill 默认使用中文；只有在 skill 明确面向外部英文受众、外部协议/字段强制要求英文，或用户明确要求英文时，才使用英文。
- Make the YAML `description` explicit enough to trigger on real user requests.
- 新增或重写 skill 不只创建文件，还必须同步维护触发索引：至少让 `description` 覆盖真实用户说法、任务类型和触达代码面；如果该 skill 是某类任务的入口规则，还要在 `AGENTS.md` 的 skill 路由、相关命令或治理说明中增加索引。
- Keep `SKILL.md` procedural and concise.
- Do not create extra README/changelog files inside a skill.
- Prefer direct checklists and commands over long philosophy.
- If the body is getting large, split details into `references/` and link them from `SKILL.md` with clear loading conditions.
- When updating a skill, treat token reduction as a success criterion: remove stale or duplicated guidance in the same pass when practical.

## Command Rules

- Project meta commands belong in `commands/commands.md`.
- `AGENTS.md` should keep only command names and one-line meanings.
- Do not mix package commands, product CLI usage, deployment scripts, or business execution commands into the meta command index.

## Iteration Logging

Instruction-system rewrites are non-code changes.

- If the change is only a tiny wording or index fix, no iteration directory is needed.
- If the change is a large rules restructure, token optimization, or skill migration, use `nextclaw-iteration-log-governance` at the end to decide whether to create or update a `docs/logs` entry.

## Final Check

Before finishing:

1. Recount `AGENTS.md` size.
2. Confirm details moved out of `AGENTS.md` are still reachable through skill descriptions.
3. Confirm no hard rule was moved only to an ordinary doc.
4. Confirm whether command entries, governance scripts, and baselines/tests were intentionally updated or intentionally left untouched with reason.
5. State whether build/lint/tsc are not applicable because the change was instruction/skill text only.
