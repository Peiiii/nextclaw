# NextClaw Hermes-Inspired Learning Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不重造 Hermes 全量 runtime、也不新增专门 `skill_manage` 工具的前提下，让 NextClaw 先补齐 `skill 列表稳定注入` 与 `AI 主动复盘、主动抽象、主动沉淀 skill` 的学习闭环，再补 `session_search`，最后基于现有子 agent / child session 能力实现后台复盘写回。

**Architecture:** 复用 NextClaw 现有 `SkillsLoader`、prompt builder、session persistence、`sessions_*` 与 subagent/runtime 基础设施，只补“让模型知道有 skill、会在任务后主动复盘、能把复盘结果抽象成 skill 候选、并在合适时机写回”的闭环层。不新增第一阶段专用 skill 编辑工具；实现层可继续复用现有文件能力，但产品重点放在“自动学习协议”而不是“文件编辑动作”本身。`session_search` 先作为独立 recall 基础设施落地，再让后台复盘通过现有 child session / background session request 在其上工作，不把它们挤进 memory。

**Tech Stack:** TypeScript, Vitest, NextClaw core agent context, NCP toolkit session persistence, Hono UI routes, existing file/session/subagent tools, Markdown skills.

---

## 长期目标对齐 / 可维护性推进

这次不是为了“把 Hermes 再做一遍”，而是为了让 NextClaw 更像个人操作层：会积累经验、会复用工作流、会在多会话中持续变得更顺手。方案默认坚持三点：

1. 不新增第一阶段专用 `skill_manage` 工具，把重点放在自动学习协议与沉淀闭环，而不是工具表面形态。
2. 不把 durable memory、history recall、procedural memory 混成一锅粥。
3. 不在一个热点中心文件里叠补丁，而是沿 `skills/context/runtime/session-search/subagent-session-request` 边界分别推进。

## 当前结论

基于当前仓库，以下事实已经成立：

1. **`skill 列表注入` 已经存在，不是空白。**
   - 主 system prompt 通过 [`packages/nextclaw-core/src/agent/context.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/context.ts) 注入 `active_skills` 与 `available_skills`。
   - 具体注入文案在 [`packages/nextclaw-core/src/agent/skill-context.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/skill-context.ts)。
   - runtime user prompt 也会注入 requested skills，见 [`packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts)。
2. **`AI 主动学习并沉淀 skill` 还没有闭环。**
   - 现在缺的不是“能不能改 skill 文件”，而是“任务结束后会不会主动复盘、会不会抽象出复用模式、会不会把经验提升成 skill 候选”的稳定协议。
3. **`session_search` 还没有正式能力。**
   - 现有 [`sessions_history`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tools/sessions.ts) 只适合定向取历史，不是“跨会话召回”。
   - 后端全文搜索方向已经在 [`docs/plans/2026-04-13-chat-global-content-search-design.md`](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-13-chat-global-content-search-design.md) 里定过大方向。
4. **后台复盘写回还没有 Hermes 式机制。**
   - 但仓库已经有 [`spawn`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tools/spawn.ts)、[`subagents`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tools/subagents.ts) 与 child session / cross-session request 方向，不需要从零造第二套 agent loop。

## 范围与优先级

### P0

1. 确认并补齐所有主要 runtime 的 `skill 列表注入` 一致性。
2. 让 AI 在任务结束后主动产出复盘总结，并判断是否应沉淀为新 skill 或修补已有 skill。
3. 让这个“复盘 -> 抽象 -> skill 候选”成为明确协议，而不是偶发灵感。

### P1

3. 实现 `session_search`，让历史过程回忆与 durable memory 分层，并为后台复盘提供检索底座。

### P2

4. 增加后台复盘写回能力：任务结束后用现有子 agent / child session 机制自动判断是否应沉淀/修补 skill。

### 明确暂缓

1. Honcho 式用户画像层。
2. embedding-first 长期记忆。
3. 单独的 `skill_manage` 专用工具。

## 设计决策

### 决策 1：第一阶段不新增专门 `skill_manage` 工具

理由：

1. 当前问题的关键不是“有没有编辑入口”，而是“AI 会不会主动学习、主动抽象、主动沉淀”。
2. 专用工具会引入新的 schema、权限边界、实现和维护成本，但并不会自动解决学习闭环本身。
3. 真正缺的是“何时必须复盘、如何把复盘抽象成 skill、什么情况下应该新增/修补 skill”的协议。

第一阶段方案：

1. 用 prompt contract 明确要求：当任务形成可复用 workflow、踩坑修复、稳定套路或明显知识增量时，必须先产出复盘总结。
2. 复盘总结必须进一步回答：这次经验是否值得提升为新 skill，还是只是补丁到已有 skill。
3. 用测试保证模型可见链路中确实有这些提示与判断步骤。

只有在第一阶段证明“学习协议已经成立，但落地写回动作仍明显不够顺滑”时，才进入第二阶段评估专用工具。

### 决策 2：`session_search` 走独立查询面，不复用 memory

理由：

1. `memory` 存稳定事实与偏好。
2. `session_search` 存历史过程与旧决策轨迹。
3. 把两者混起来会让记忆膨胀、污染 prompt，并且破坏可解释性。
4. 后台复盘若未来要看“之前怎么做过类似事”，也应查 `session_search`，而不是翻 memory。

### 决策 3：`session_search` 要先于后台复盘落地

理由：

1. 复盘若只盯当前会话，很容易退化成“当前 transcript 再总结一遍”，而不是真正的跨会话经验沉淀。
2. 先有独立 recall 层，复盘才能在需要时引用旧会话、旧修复、旧 skill 轨迹。
3. 这也更符合 NextClaw 作为统一入口的方向：先补通用检索底座，再让上层 agent 工作流复用。

### 决策 4：后台复盘应复用现有 session/subagent 基础，而不是造第二套 agent loop

理由：

1. 仓库已经有 `spawn`、`subagents`、session persistence，以及 child session / cross-session request 的协议方向。
2. 复盘本质是“低优先级、异步、可容错”的附加执行，不需要再造 Hermes runner。
3. 第一版完全可以表现为“主任务结束后调度一个 background child session / session request”，而不是新发明线程模型。

## Task 1: Skill Visibility Consistency Audit And Patch

**Files:**
- Check: [`packages/nextclaw-core/src/agent/skill-context.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/skill-context.ts)
- Check: [`packages/nextclaw-core/src/agent/context.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/context.ts)
- Check: [`packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts)
- Check: [`packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.ts)
- Modify: [`packages/nextclaw-core/src/agent/tests/skills.test.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tests/skills.test.ts)
- Modify: [`packages/nextclaw-core/src/agent/tests/runtime-user-prompt.test.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tests/runtime-user-prompt.test.ts)
- Modify: [`packages/nextclaw/src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts)

**Step 1: Add failing tests for skill visibility**

覆盖三条链：

1. 主 system prompt 必须包含 `<available_skills>`。
2. 有 always-on skill 时必须包含 `<active_skills>`。
3. requested skills 必须在 runtime user prompt / NCP prompt 中保留。

**Step 2: Run focused tests**

Run:

```bash
pnpm vitest run packages/nextclaw-core/src/agent/tests/skills.test.ts packages/nextclaw-core/src/agent/tests/runtime-user-prompt.test.ts packages/nextclaw/src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts
```

**Step 3: Patch gaps only if any test fails**

补的不是“再造 skill 系统”，只补一致性缺口，例如：

1. 某条 runtime 没有 `available_skills`。
2. requested skills 在 metadata -> prompt 传递时丢失。
3. `active_skills` / `available_skills` 的优先级提示不一致。

**Step 4: Re-run tests**

同上。

**Step 5: Commit**

```bash
git add packages/nextclaw-core/src/agent/skill-context.ts packages/nextclaw-core/src/agent/context.ts packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.ts packages/nextclaw-core/src/agent/tests/skills.test.ts packages/nextclaw-core/src/agent/tests/runtime-user-prompt.test.ts packages/nextclaw/src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts
git commit -m "test: lock skill visibility across prompt builders"
```

## Task 2: Teach AI To Proactively Summarize, Abstract, And Propose Skills

**Files:**
- Modify: [`packages/nextclaw-core/src/agent/skill-context.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/skill-context.ts)
- Modify: [`packages/nextclaw-core/src/agent/context.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/context.ts)
- Modify: [`packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts)
- Modify or add builtin skill guidance under [`packages/nextclaw-core/src/agent/skills/skill-creator`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/skills/skill-creator)
- Test: [`packages/nextclaw-core/src/agent/tests/context.test.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tests/context.test.ts)
- Test: [`packages/nextclaw-core/src/agent/tests/runtime-user-prompt.test.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tests/runtime-user-prompt.test.ts)

**Step 1: Write failing tests for the new contract**

至少覆盖：

1. system prompt 明确告诉 AI：任务完成后若形成可复用模式，必须主动产出复盘总结。
2. 复盘总结必须继续判断：这次经验应不应该提升为新 skill，还是补丁到已有 skill。
3. 复盘结果应包含“触发条件 / 适用场景 / 核心步骤 / 失败信号”这类可 skill 化要素，而不是只写流水账。

**Step 2: Run focused tests**

```bash
pnpm vitest run packages/nextclaw-core/src/agent/tests/context.test.ts packages/nextclaw-core/src/agent/tests/runtime-user-prompt.test.ts
```

**Step 3: Implement the minimal contract**

内容收敛为三部分：

1. **触发条件**：复杂任务、踩坑修复、流程收敛、重复动作、旧 skill 失效。
2. **复盘输出**：先总结本次学到了什么，再判断是否应新增/修补 skill。
3. **skill 抽象标准**：只有当经验足够可复用、可触发、可执行、可验证时，才提升为 skill。

这里不新增工具；若需要补充说明，优先修改内建 `skill-creator` 或新增一个轻量内建 skill 说明，而不是新增 executable tool。实现层即便仍复用现有文件能力，也不把“如何写文件”当成这一阶段的产品重点。

**Step 4: Re-run tests**

同上。

**Step 5: Commit**

```bash
git add packages/nextclaw-core/src/agent/skill-context.ts packages/nextclaw-core/src/agent/context.ts packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts packages/nextclaw-core/src/agent/skills/skill-creator packages/nextclaw-core/src/agent/tests/context.test.ts packages/nextclaw-core/src/agent/tests/runtime-user-prompt.test.ts
git commit -m "feat: teach agents to summarize and propose skills"
```

## Task 3: Implement Session Search As A Separate Recall Layer

**Files:**
- Reference: [`docs/plans/2026-04-13-chat-global-content-search-design.md`](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-13-chat-global-content-search-design.md)
- Reference: [`packages/nextclaw-core/src/agent/tools/sessions.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tools/sessions.ts)
- Reference: [`packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-backend-session-persistence.ts`](/Users/peiwang/Projects/nextbot/packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-backend-session-persistence.ts)
- Create: a dedicated session-search tool/service under the existing session tool boundary
- Create tests near the chosen implementation files

**Step 1: Write failing tests for cross-session recall**

至少覆盖：

1. 能按 query 跨会话检索历史文本。
2. 默认排除当前 session。
3. 返回结果包含：`sessionId / snippet / matched field / timestamp`。

**Step 2: Run focused tests**

按新增测试路径执行。

**Step 3: Implement minimal `session_search`**

第一版要求：

1. 走独立查询面，不滥用 `sessions_list`。
2. 先支持 keyword / FTS 风格全文搜索。
3. 不与 `memory_search` 混用。
4. 返回轻量 snippet，不直接拉整段 transcript。

可选第二步再补：

1. 命中 message 定位
2. 更强排序
3. UI search surface

**Step 4: Re-run tests**

**Step 5: Commit**

```bash
git add packages/nextclaw-core/src/agent/tools packages/ncp-packages/nextclaw-ncp-toolkit/src/agent docs/plans/2026-04-13-chat-global-content-search-design.md
git commit -m "feat: add cross-session search recall layer"
```

## Task 4: Add Background Skill Review After Task Completion

**Files:**
- Check/Modify runtime execution boundary under [`packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend`](/Users/peiwang/Projects/nextbot/packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend)
- Check/Modify subagent/session tools under [`packages/nextclaw-core/src/agent/tools/subagents.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tools/subagents.ts)
- Check/Modify spawn/session tools under [`packages/nextclaw-core/src/agent/tools/spawn.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tools/spawn.ts) and [`packages/nextclaw-core/src/agent/tools/sessions.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tools/sessions.ts)
- Reference: [`docs/plans/2026-04-03-cross-session-request-and-child-session-design.md`](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-03-cross-session-request-and-child-session-design.md)
- Add tests under [`packages/ncp-packages/nextclaw-ncp-toolkit/src/agent`](/Users/peiwang/Projects/nextbot/packages/ncp-packages/nextclaw-ncp-toolkit/src/agent)

**Step 1: Write failing tests for asynchronous review scheduling**

至少覆盖：

1. 主任务完成后会调度一个低优先级复盘动作。
2. 复盘失败不影响主回复完成。
3. 复盘任务默认只尝试 skill review，不先扩展到 memory auto-write。
4. 第一版复盘执行复用 background child session / session request / subagent 路径，而不是新线程执行器。

**Step 2: Run focused tests**

按新增测试路径执行。

**Step 3: Implement minimal background review**

第一版只做：

1. 主 run 结束后，若本轮满足条件，则调度一条“skill review”后台任务。
2. review prompt 只回答一个问题：这轮是否应新增/修补 skill。
3. review 自身仍通过现有文件工具改 skill，不新增专用 skill tool。
4. 优先复用现有 `spawn` / child session / cross-session request 语义；如果第一版只需要其中一条最短路径，也应沿这条协议演进。
5. 若复盘需要取旧案例，统一调用 `session_search`，而不是读 memory。

不要第一版就做：

1. memory auto-write
2. 多层优先级调度
3. 复杂评分系统

**Step 4: Re-run tests**

按新增测试路径执行。

**Step 5: Commit**

```bash
git add packages/ncp-packages/nextclaw-ncp-toolkit/src/agent packages/nextclaw-core/src/agent/tools/subagents.ts packages/nextclaw-core/src/agent/tools/spawn.ts packages/nextclaw-core/src/agent/tools/sessions.ts
git commit -m "feat: add background skill review loop"
```

## 验证策略

### P0 验证

1. `available_skills` / `active_skills` / `requested_skills` 在主 prompt、runtime prompt、NCP prompt 中都可见。
2. 文案明确要求 AI 在任务后主动产出复盘总结，而不是只在用户点名时才总结。
3. 复盘总结会继续判断“是否应新增 skill / 修补 skill / 不需要沉淀”。
4. 不引入新的 skill 管理 tool schema。

### P1 验证

1. 给定一个旧会话关键词，AI 可通过 `session_search` 找回相关片段。
2. 当前会话默认不混入结果。
3. 检索结果不会污染 durable memory。

### P2 验证

1. 主任务成功返回后，后台 review 会被调度。
2. review 出错不会中断主流程。
3. 至少能在测试环境里观察到“应创建/应 patch skill”的动作触发。
4. 后台 review 通过现有子 agent / child session 路径执行，而不是独立 runner。

## 风险与防守线

1. **风险：AI 乱改 skill。**  
   第一阶段先把重点放在“会不会正确复盘和抽象”，而不是鼓励它一上来就频繁改 skill；先控制沉淀判断质量，再扩写回动作。

2. **风险：后台复盘变成噪音制造器。**  
   第一版只做 skill review，不做 memory auto-write，不做多目标复盘；必要时只在命中明确触发条件时才调度 background child session。

3. **风险：`session_search` 与 memory 语义混淆。**  
   工具命名、提示文案、返回结构必须明确区分“稳定事实”和“历史过程”。

4. **风险：后台复盘先造了一套和现有多 agent 脱节的新机制。**  
   第一版明确要求复用 `spawn` / `subagents` / child session / session request 语义，不新增平行线程体系。

## 推荐实施顺序

1. Task 1: Skill visibility consistency
2. Task 2: AI proactive summarize and skill proposal
3. Task 3: Session search
4. Task 4: Background skill review

## 本计划的最终判断

按当前现状，最值钱的路线不是“先造 skill 管理新工具”，而是：

1. 先确保 skill 真的稳定可见。
2. 再让 AI 被明确要求主动复盘、主动抽象，并判断是否应沉淀成 skill。
3. 再补 `session_search`，把跨会话历史召回做成独立底座。
4. 最后基于现有子 agent / child session 能力，把 skill 维护做成后台复盘闭环。

这样最符合你现在给的优先级，也最符合 NextClaw 现有架构。
