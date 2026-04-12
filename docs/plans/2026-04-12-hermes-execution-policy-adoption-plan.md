# Hermes Execution Policy Adoption Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 NextClaw 中以可插拔方式引入一套直接借鉴 Hermes 的执行纪律层，显著提升 GPT-5.4 / Codex / Gemini 等模型的主动性、任务一次性完成率和“先做后说”的稳定性。

**Architecture:** 不复制 Hermes 的整套厚 runtime，只复制最影响主动性的最小闭环：执行纪律、按模型追加规则、连续性分工提示、稳定/瞬时 prompt 分层。实现上新增一个独立的 `execution-policy` 模块，由它生成可组合的 policy sections，并在 legacy `ContextBuilder`、NCP context builder、Codex/Claude runtime prompt builder 三条链统一接入。所有策略都必须支持按 runtime、按模型、按 session、按 config 开关启停，禁止把 Hermes 文案硬编码散落到多个入口。

**Tech Stack:** TypeScript、Vitest、NextClaw core/runtime/NCP packages、Markdown 设计文档。

---

## 长期目标对齐 / 可维护性推进

这次工作不是“把 prompt 再写长一点”，而是顺着 NextClaw 成为统一入口与操作层的方向，补齐一个长期缺失的系统能力：

- 让模型更像执行代理，而不是聊天模型。
- 让主动性来自稳定的 runtime 机制，而不是某个模型偶然发挥。
- 让不同 runtime 的行为边界更一致，而不是同一用户在不同入口体验到不同“勤快程度”。

本方案默认遵循以下维护性原则：

1. 不复制 Hermes 的整坨 runner，只复制最值钱的行为机制。
2. 不把执行纪律散落到 `ContextBuilder`、NCP builder、runtime plugin 文案里各写一份。
3. 不为单模型打一次性补丁，而是抽象成可配置、可复用、可灰度的 policy pack。
4. 不引入第二套上下文拼装体系，而是让 policy 成为现有上下文体系的一个独立 section provider。
5. 任何新增代码都必须服务于“统一接入点 + 更少重复 + 更清晰边界”。

---

## 一句话结论

NextClaw 最值得直接“抄” Hermes 的，不是更多工具，也不是更厚的 system prompt，而是这四个东西：

1. `tool-use enforcement`
2. 按模型注入的 `execution discipline`
3. `memory / session recall / skills` 的明确分工提示
4. stable prompt prefix 与 ephemeral overlay 的分层

这四个东西如果抄对了，GPT-5.4 这类本来容易“口头承诺但不立刻执行”的模型，会明显更像 agent。

---

## 先抄什么，不抄什么

### 必须直接借鉴的部分

#### A. Tool-use enforcement

这是 Hermes 主动性的第一抓手，核心约束是：

- 说了要做，就必须立刻调用工具
- 不能停在“我来帮你检查一下”这种口头承诺
- 非最终回复必须包含实际推进
- 如果工具还能推进，就不要提前收尾

这是当前 NextClaw 与 Hermes 体感差距最大的地方，必须优先抄。

#### B. Model-specific execution discipline

对 GPT/Codex/Gemini 这类模型，Hermes 不是只加一条泛泛提示，而是补了针对懒惰点的规则：

- 当前事实不能凭空答，必须先查
- 有明显默认解释时先执行，不先反问
- 工具结果不完整时先重试，而不是马上放弃
- 最终输出前先验证需求是否真的满足

这部分也应该直接借鉴，而且要做成按模型匹配的 pack。

#### C. Continuous-context role separation

Hermes 主动性不只靠 prompt，还靠它把连续性拆清楚：

- `memory`: 稳定事实
- `session_search`: 历史过程
- `skills`: procedural memory

NextClaw 当前已经有 `memory_search` / `memory_get` 和 skills，但缺 `session recall` 这一层。第一阶段不需要立刻补完整搜索能力，但至少要先把分工提示抄过来。

#### D. Stable vs ephemeral layering

Hermes 会刻意把稳定规则层和瞬时层分开，避免每轮都把核心纪律拼碎。NextClaw 也应该这样做：

- stable layer: identity / execution policy / skill protocol / context policy
- ephemeral layer: 本轮任务特有说明、系统事件、session continue 通知、临时时间 hint

### 明确不抄的部分

#### A. 不抄 Hermes 全量 prompt 文案

我们要借鉴机制，不是把大段英文原文直接搬过来。否则只会：

- 和 NextClaw 现有规则重复
- 把 prompt 继续堆胖
- 降低可读性与维护性

#### B. 不抄 Hermes 的整套厚 runtime

本轮不引入：

- Hermes 式 context compressor 复制版
- execute_code / delegate_task 的全部策略复制
- 全量 toolset / provider routing 行为复制

这些都不是主动性第一优先级。

#### C. 不搞“再造一个 Hermes mode”

NextClaw 不应新增一套平行 agent mode。正确做法是：

- 沿现有 runtime/context 架构新增一个 policy injection layer
- 让现有 runtime 共享它

---

## 推荐方案

### 方案 A：直接在现有各处 prompt 文案里分别加规则

优点：

- 起步最快
- 改动面看起来最小

缺点：

- 规则会复制到 3 到 4 个入口
- 一旦要改文案，必须多处同步
- legacy / NCP / Codex / Claude 很容易继续漂移

结论：

不推荐。它会最快见效，但也会最快变脏。

### 方案 B：新增共享 `execution-policy` 模块，由各入口按条件拼装

优点：

- 最符合“可插拔 + 结构清晰 + 可维护”
- 可以复用 Hermes 机制而不复制实现形态
- 能做按模型、按 runtime、按开关灰度
- 后续可以继续挂接 `session recall policy` / `verification policy`

缺点：

- 首版会多做一点抽象
- 需要梳理现有 prompt 组装边界

结论：

这是推荐方案。

### 方案 C：只在 Codex/GPT runtime 上单独补纪律

优点：

- 最接近当前痛点
- 用户最容易立即感知

缺点：

- 只修最显眼的一条链
- 其它 runtime 继续行为漂移
- 后面大概率返工为共享层

结论：

可以作为灰度顺序，但不应该作为最终架构。

---

## 最终架构

### 新增模块边界

建议在 [`packages/nextclaw-core/src/agent`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent) 下新增一组独立文件：

- `execution-policy/execution-policy-types.ts`
- `execution-policy/execution-policy-config.ts`
- `execution-policy/execution-policy-pack.ts`
- `execution-policy/execution-policy-sections.ts`
- `execution-policy/model-execution-policy.ts`
- `execution-policy/execution-policy-resolver.ts`

职责拆分：

- `types`: 定义 policy section、model matcher、runtime scope
- `config`: 读取 `agents.context.executionPolicy` 或等价配置
- `pack`: 定义 Hermes-inspired policy packs
- `sections`: 输出可注入 prompt 的 section 文本
- `model-execution-policy`: 处理 GPT/Codex/Gemini 的模型特化规则
- `resolver`: 对外暴露一个统一入口，供 legacy/NCP/runtime plugin 调用

### 统一接入点

第一阶段只允许以下三个边界接入：

1. [`packages/nextclaw-core/src/agent/context.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/context.ts)
2. [`packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.ts)
3. [`packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts)

禁止：

- 在 `loop.ts` 内直接硬塞大段新规则文案
- 在 Codex / Claude plugin 中各自复制一套 Hermès 风格提示
- 在 UI 层重新拼接主动性规则

### 注入形态

统一由 resolver 生成两个产物：

- `stableSystemSections`
- `ephemeralUserOverlaySections`

其中：

- `stableSystemSections` 用于 identity / system prompt 链
- `ephemeralUserOverlaySections` 用于当前轮系统事件、continue 通知、临时任务导向

这样可以与现有 [`ContextBuilder`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/context.ts#L85) 和 [`RuntimeUserPromptBuilder`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts#L99) 的分层方式对齐。

---

## 第一阶段直接抄的 policy 内容

### Pack 1：Tool Use Enforcement

建议直接转译为 NextClaw 风格的约束：

- 当你说要检查、运行、读取、搜索、修改、验证时，必须在同一回合立即调用对应工具。
- 不要用“我来帮你”“我会去做”结束当前回复，除非这一回合已经真的调用了工具。
- 如果任务仍可继续推进，不要提前结束回复。
- 每次回复要么包含实际推进，要么给出最终结果。

### Pack 2：OpenAI/Codex Execution Discipline

建议直接抄 Hermes 的最值钱部分，但收敛为 NextClaw 版本：

- 时间、日期、系统状态、文件内容、git 状态、当前事实禁止凭空答
- 有默认作用域时先执行，不先反问
- 工具结果为空或不完整时先重试一种不同策略
- 最终回复前检查：是否满足所有要求、是否基于工具结果、是否需要继续验证

### Pack 3：Google Model Operational Guidance

先只抄 4 条：

- 多个独立读取操作尽量并行
- 编辑前先读取上下文
- 使用绝对路径或明确路径
- 以结果为中心，少讲过程废话

### Pack 4：Continuous Context Discipline

在 NextClaw 现有 memory/skills 基础上补清楚：

- `memory_search/memory_get` 只负责稳定事实与偏好
- 历史任务过程不应该挤进 memory
- skills 是 procedural memory
- 后续补 `session recall` 能力后，它负责历史过程回忆

---

## NextClaw 配置设计

建议在 `agents.context` 下新增一组可热应用配置，而不是散在多个 path：

```json
{
  "agents": {
    "context": {
      "executionPolicy": {
        "enabled": true,
        "mode": "hermes-inspired",
        "packs": {
          "toolUseEnforcement": true,
          "openaiExecutionDiscipline": true,
          "googleOperationalGuidance": true,
          "continuousContextDiscipline": true
        },
        "modelMatchers": {
          "toolUseEnforcement": ["gpt", "codex", "gemini", "gemma", "grok"],
          "openaiExecutionDiscipline": ["gpt", "codex"],
          "googleOperationalGuidance": ["gemini", "gemma"]
        }
      }
    }
  }
}
```

设计原则：

- `enabled` 是总开关
- `packs` 控制每个 policy 包
- `modelMatchers` 可覆盖默认匹配规则
- 所有配置都应支持运行时生效

---

## 与现有结构的对齐方式

### Legacy ContextBuilder

当前 [`ContextBuilder.getIdentity()`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/context.ts#L197) 已经塞了较多工具风格、memory recall、subagent 使用建议。第一阶段不应继续堆在这里，而应：

- 保留现有产品规则
- 新增一个 `execution policy sections` 拼接位
- 让主动性规则成为独立 section

建议顺序：

1. identity / product rules
2. execution policy
3. requested skills
4. project context
5. memory
6. active / available skills

### NCP Context Builder

当前 [`nextclaw-ncp-context-builder.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.ts) 主要负责 metadata、tool filtering、session orchestration。它应该做的是：

- 从共享 resolver 取 stable policy sections
- 把这些 sections 合并进 `systemPrompt`
- 不自己发明第二套“主动性文案”

### Runtime User Prompt Builder

当前 [`RuntimeUserPromptBuilder`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts#L141) 更像 bootstrap-aware user overlay。这里应该接：

- policy resolver 返回的 ephemeral overlay sections
- 例如 continue / follow-up / internal task completion 的执行提醒

这样能与 Hermes 的 stable vs ephemeral 分层相似，但仍贴合 NextClaw 当前结构。

---

## 第二阶段预留能力

第一阶段不实现，但架构必须预留挂点：

### A. Session Recall Policy

未来新增：

- `session_recall_search`
- `session_recall_get`

然后把 continuous-context discipline 从“提示先拆清”升级成真正能力闭环。

### B. Verification Policy

未来可以增加统一的 verification section provider：

- 文件修改后要跑最小验证
- 命令执行后要检查退出码与关键输出
- 查 web/current facts 后要带来源

### C. Prompt Budget Governance

未来再补：

- policy section token budget
- per-runtime trimming
- stable prompt cache hints

但第一阶段不要提前做。

---

## 灰度与上线策略

### 灰度顺序

1. 先在 Codex / GPT 相关 runtime 打开
2. 再扩到 Gemini
3. 再扩到 legacy context builder 默认开启

原因：

- 用户体感最强的痛点就是 GPT/Codex 偏懒
- 先在最需要的模型链验证收益
- 避免一上来全量打开后不好定位行为漂移

### 开关策略

必须支持三层开关：

1. 全局 `enabled`
2. per-pack enable/disable
3. per-model matcher override

### 观察指标

至少记录这些观察点：

- 单轮任务工具调用次数变化
- “只给计划、不执行”的回复比例
- 因提前收尾导致二次追问的比例
- 平均 prompt tokens 增幅
- 用户可见失败模式是否转向“更啰嗦”或“过度调用工具”

---

## 失败模式与防护

### 风险 1：过度调用工具

表现：

- 明明能直接答，也强行调工具
- 一些简单任务反而更慢

防护：

- 执行纪律只对相关模型启用
- policy 内明确“工具是为正确性和完成度服务，不是为了表演调用”

### 风险 2：prompt 膨胀

表现：

- 主动性变好了，但 token 成本明显升高

防护：

- 第一阶段严格限制 section 长度
- 共享文案，不复制多份
- 不把 Hermes 的整段长文全部抄来

### 风险 3：多 runtime 行为继续漂移

表现：

- Codex 变勤快了，legacy/NCP 还是老样子

防护：

- 强制只从共享 resolver 取 policy
- review 时禁止 runtime 局部追加一套单独文案

### 风险 4：把复杂度换个位置保留

表现：

- 表面上抽了模块，实际上规则判断散在 resolver、builder、plugin 三处

防护：

- 所有匹配逻辑收敛在 `execution-policy-resolver`
- builder 只负责消费 section，不负责决策

---

## 具体实施任务

### Task 1: 建立执行策略模块骨架

**Files:**
- Create: `packages/nextclaw-core/src/agent/execution-policy/execution-policy-types.ts`
- Create: `packages/nextclaw-core/src/agent/execution-policy/execution-policy-config.ts`
- Create: `packages/nextclaw-core/src/agent/execution-policy/execution-policy-pack.ts`
- Create: `packages/nextclaw-core/src/agent/execution-policy/execution-policy-sections.ts`
- Create: `packages/nextclaw-core/src/agent/execution-policy/model-execution-policy.ts`
- Create: `packages/nextclaw-core/src/agent/execution-policy/execution-policy-resolver.ts`
- Test: `packages/nextclaw-core/src/agent/execution-policy/execution-policy-resolver.test.ts`

**Step 1: Write the failing tests**

覆盖：

- 默认配置下 GPT/Codex 命中 `toolUseEnforcement + openaiExecutionDiscipline`
- Gemini 命中 `toolUseEnforcement + googleOperationalGuidance`
- 未命中模型只返回 continuous-context discipline
- 关闭 pack 后不返回对应 section

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @nextclaw/core exec vitest run src/agent/execution-policy/execution-policy-resolver.test.ts`

**Step 3: Write minimal implementation**

实现一个纯 resolver，不依赖具体 runtime，只依赖：

- model
- runtime kind
- config
- available capabilities

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @nextclaw/core exec vitest run src/agent/execution-policy/execution-policy-resolver.test.ts`

**Step 5: Commit**

```bash
git add packages/nextclaw-core/src/agent/execution-policy
git commit -m "feat: add pluggable execution policy resolver"
```

### Task 2: 接入 legacy ContextBuilder

**Files:**
- Modify: `packages/nextclaw-core/src/agent/context.ts`
- Test: `packages/nextclaw-core/src/agent/context.execution-policy.test.ts`

**Step 1: Write the failing tests**

覆盖：

- 命中 GPT 模型时 system prompt 包含 execution policy section
- 不命中模型时不包含 model-specific section
- 现有 requested skills / memory / bootstrap 顺序不被破坏

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @nextclaw/core exec vitest run src/agent/context.execution-policy.test.ts`

**Step 3: Write minimal implementation**

- 在 `buildSystemPrompt()` 中增加独立 section 注入
- `getIdentity()` 不继续堆大段执行纪律文案

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @nextclaw/core exec vitest run src/agent/context.execution-policy.test.ts`

**Step 5: Commit**

```bash
git add packages/nextclaw-core/src/agent/context.ts packages/nextclaw-core/src/agent/context.execution-policy.test.ts
git commit -m "feat: inject shared execution policy into context builder"
```

### Task 3: 接入 NCP Context Builder

**Files:**
- Modify: `packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.ts`
- Test: `packages/nextclaw/src/cli/commands/ncp/context/nextclaw-ncp-context-builder.execution-policy.test.ts`

**Step 1: Write the failing tests**

覆盖：

- NCP system prompt 命中 GPT 模型时包含执行纪律
- requested tools / requested skills 过滤行为不回归

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/context/nextclaw-ncp-context-builder.execution-policy.test.ts`

**Step 3: Write minimal implementation**

- 使用共享 resolver 生成 stable policy sections
- 合并到 NCP system prompt 生成链，不新增第二套文案判断

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/context/nextclaw-ncp-context-builder.execution-policy.test.ts`

**Step 5: Commit**

```bash
git add packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.ts
git commit -m "feat: reuse execution policy in ncp context builder"
```

### Task 4: 接入 runtime user prompt overlay

**Files:**
- Modify: `packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts`
- Test: `packages/nextclaw-core/src/runtime-context/runtime-user-prompt.execution-policy.test.ts`

**Step 1: Write the failing tests**

覆盖：

- builder 会拼接 bootstrap context + requested skills + ephemeral execution overlay
- 同一 policy 不会重复注入 stable 和 ephemeral 两遍

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @nextclaw/core exec vitest run src/runtime-context/runtime-user-prompt.execution-policy.test.ts`

**Step 3: Write minimal implementation**

- 从 resolver 拉取 ephemeral overlay sections
- 拼接到当前 user prompt 叠层

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @nextclaw/core exec vitest run src/runtime-context/runtime-user-prompt.execution-policy.test.ts`

**Step 5: Commit**

```bash
git add packages/nextclaw-core/src/runtime-context/runtime-user-prompt.ts
git commit -m "feat: add execution policy overlay to runtime user prompt"
```

### Task 5: 补配置与文档

**Files:**
- Modify: `packages/nextclaw-core/src/config/schema.ts`
- Modify: `packages/nextclaw-core/src/config/schema.help.ts`
- Modify: `docs/USAGE.md`
- Modify: `AGENTS.md` only if runtime governance rules need explicit alignment

**Step 1: Write the failing tests**

覆盖：

- 新配置字段可被 schema 正常解析
- 默认值与 matcher 生效

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @nextclaw/core exec vitest run src/config/schema.execution-policy.test.ts`

**Step 3: Write minimal implementation**

- 配置 schema 只加入必要字段
- 文档写清楚这是 Hermes-inspired execution policy，不是第二套 runtime

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @nextclaw/core exec vitest run src/config/schema.execution-policy.test.ts`

**Step 5: Commit**

```bash
git add packages/nextclaw-core/src/config docs/USAGE.md
git commit -m "feat: add execution policy config and docs"
```

### Task 6: 跑最小充分验证

**Files:**
- No code changes

**Step 1: Run focused tests**

Run:

```bash
pnpm --filter @nextclaw/core exec vitest run \
  src/agent/execution-policy/execution-policy-resolver.test.ts \
  src/agent/context.execution-policy.test.ts \
  src/runtime-context/runtime-user-prompt.execution-policy.test.ts \
  src/config/schema.execution-policy.test.ts

pnpm -C packages/nextclaw test -- --run \
  src/cli/commands/ncp/context/nextclaw-ncp-context-builder.execution-policy.test.ts
```

**Step 2: Run type checks**

Run:

```bash
pnpm -C packages/nextclaw-core tsc
pnpm -C packages/nextclaw tsc
```

**Step 3: Run maintainability guard**

Run:

```bash
pnpm lint:maintainability:guard
```

**Step 4: Commit**

```bash
git add -A
git commit -m "test: validate execution policy adoption"
```

---

## 验收标准

完成后必须满足：

1. GPT/Codex 在 NextClaw 中获得 Hermes 风格的“先做后说”纪律。
2. 同一套执行纪律由共享模块统一生成，不在多个 runtime 各写一份。
3. legacy / NCP / runtime user prompt 的主动性规则明显更一致。
4. 新能力是可关闭、可灰度、可按模型匹配的。
5. 没有为了这次改动引入第二套上下文拼装体系。

---

## 不可接受的落地方式

- 直接把 Hermes 英文原文整段拷进多个 prompt 文件
- 只修 Codex runtime，不补共享层
- 在 `loop.ts` 或单个 runtime 中写大量 if/else 规则分支
- 为了“先见效”引入一个名为 `hermesMode` 的平行执行模式
- 把连续性分工、执行纪律、模型匹配逻辑散落在 builder、plugin、UI 三处

---

## 最后建议

如果只能做一个最小版本，建议只做：

1. 共享 `execution-policy resolver`
2. `toolUseEnforcement`
3. `openaiExecutionDiscipline`
4. 在 legacy + NCP 两条主链先接上

这是“最像 Hermes、但不会把代码抄脏”的最小闭环。
