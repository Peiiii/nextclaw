# Chat 工具过程语义摘要与信息层级设计

## 背景

长 agent 回合里，工具调用是过程证据，不是用户最终要读的答案。Claude Code CLI 的工具展示值得参考：默认给可扫的过程摘要，细节按需展开，避免多张重卡片平铺抢注意力。

但摘要不能退化成空计数。`Used 6 tools` 只说明“做了几次动作”，不说明“做了哪几类事、关键对象是什么”，用户仍必须展开才能判断要不要看细节，摘要就失效了。

本设计承接既有：

- `docs/designs/2026-07-04-chat-completed-process-collapse.design.md`：完成后整段过程折叠为轻量摘要行。
- 现有 `ChatToolCard`：单工具默认折叠、按类型特化（terminal / file / search / generic / panel app）。

目标是增强 NextClaw 作为统一工作台的**阅读效率与过程可扫性**，不是新增孤立功能点。

## 现状依据

- 产品侧 `buildChatMessageProcessSummary` 已能在完成态 assistant 消息上生成 `processSummary.label`；当前文案是 `已处理` / `Processed`，可选附带 lifecycle 耗时。
- `@nextclaw/agent-chat-ui` 的 `ChatMessage` 支持 `processSummary` 整段折叠；reasoning / tool-card 自身也支持局部折叠。
- `ChatToolCard` 按 `toolName` 分流到 terminal / file / search / generic / panel-app 视图；`ToolCardRoot` 使用 `border + shadow-sm` 卡片壳。
- `ChatToolPartViewModel` 已有 `toolName`、`summary`、`statusTone`、`statusLabel`、结构化 `fileOperation` / `panelApp` 等字段，足够做视图层语义聚合。
- 缺口：
  1. 上层摘要过粗（只有“已处理”，没有工具语义）。
  2. 同质工具不会合并（3 次 Read 仍是 3 张卡）。
  3. 默认视觉偏“每条工具一张卡”，长回合形成卡片墙。
  4. 子 agent / 嵌套工具缺少明确树形层级。

## 核心判断

1. **答案是前景，工具是背景。** 过程必须可追溯，但不能默认与最终回答同权重。
2. **两层机制必须分离，禁止混写。**
   - **外层总收起**（`processSummary`）：只表达“这一轮过程已处理 / 可选耗时”，例如 `已处理 12s`。
   - **内层工具活动组**：只对**连续 tool-card** 做语义汇总，例如 `Read 3 · Bash 2`。
3. **中间出现文本/reasoning/非 tool 内容，必须打断合并。**  
   例如 `tool, tool, markdown, tool, tool` → 两组，不是一组。
4. **摘要必须语义化，禁止空计数。** 用 `Read 3 · Bash 2 · Search 1`，不用 `Used 6 tools`，也不要把工具语义塞进 `已处理`。
5. **第一阶段只做视图投影，不改 NCP 协议。**
6. **学 CLI 的层级与降噪，不照搬终端纯文本。** 保留文件预览、diff、终端输出、panel app、打开子会话等产品交互。

## 推荐方案

### 1. 两层信息架构（不要混）

```text
L-outer  processSummary（可选，完成态整段过程）
         已处理 12s
         └─ 展开后才看到内部过程 parts

L-inner  连续 tool-card 活动组（与 outer 无关）
         ▸ Read AGENTS.md +2 · Bash pnpm test
           └─ 展开后显示该连续段里的各张 tool card

任何 markdown / reasoning / file / unknown 都会打断 L-inner 分组。
```

错误示范（已否决）：

```text
Read 3 · Bash 2 · 已处理 12s   ← 把总收起和工具汇总混成一行
```

### 2. L-outer：完成态总收起

保持 `2026-07-04-chat-completed-process-collapse` 合同：

- 文案只做 `已处理` / `Processed`，可选 lifecycle 耗时
- 不承载工具族语义
- 只在“有过程 + 有最终回答 + 非 streaming”时启用

### 3. L-inner：连续工具活动组

#### 分组规则

- 只扫描 `type === "tool-card"` 的**连续 run**
- 非 tool part 一律断组：markdown、reasoning、file、unknown、以及未来其它非 tool 类型
- 连续长度 = 1：不建组，直接渲染原生 tool card
- 连续长度 ≥ 2：折叠成一条语义摘要行，展开后显示组内全部 tool card

#### 摘要文案

| 情况 | 文案 |
|------|------|
| 单族 1 条（但因长度≥2 才成组，通常不会） | `Read AGENTS.md` |
| 单族多条 | `Read AGENTS.md +2` 或 `Read 3 files` |
| 多族混合 | `Read 3 · Bash 2 · Search 1` |
| 含失败 | 失败优先：`Bash pnpm test failed · Read 3` |
| 含取消 | `Bash 1 cancelled · Read 2` |

禁止：

- `Used N tools`
- 把 `已处理` / duration 拼进工具组摘要

### 4. 运行中 vs 完成态

| 状态 | L-outer | L-inner |
|------|---------|---------|
| streaming / pending | 不启用整段总收起 | 仍可对连续 tool-card 分组，便于降噪 |
| 完成且有最终回答 | 启用 `已处理` 总收起 | 过程展开后，内部仍按连续 tool 分组 |
| 完成但无最终回答 | 不启用 outer | 仍可 inner 分组 |
| 错误 | outer 不承载错误语义 | inner 失败优先暴露 |

### 6. 视觉与交互原则

- L0 摘要行：延续 completed-process-collapse 的轻量行内结构（灰文案、箭头、分隔），不做第二层大卡片。
- L1：行级密度，接近 CLI 树，而不是设置页卡片列表。
- L2：结构化面板，服务检查与操作，不与正文抢默认注意力。
- 整行可点展开；箭头只是示意。
- 不引入 scale / 重 shadow / primary 边框作为默认过程反馈。

## Owner 与数据流

### 产品适配层（`@nextclaw/ui`）

- `chat-message-process-summary.utils.ts`
  - 从 assistant message parts / 已适配 tool cards 推导 L0 语义摘要。
  - 输出结构化 `processSummary`（见下），不只是单一模糊字符串（实现可先拼 label，但内部必须按族聚合）。
- `chat-message-list.container.tsx` / `adaptChatMessage`
  - 继续做视图投影；不改 raw NCP message，不写 store。
- i18n `chat.json`
  - 族标签、`+N`、failed/cancelled、files/commands 等可复用片段。

### 共享 UI（`@nextclaw/agent-chat-ui`）

- `ChatMessage`
  - 消费增强后的 `processSummary`；负责 L0 折叠壳。
- 新增或内聚的 tool activity 展示 owner（建议）
  - 例如 `chat-tool-activity.*`：把连续 tool-card parts 投影为 L1 族/行。
  - 不复制 terminal/file/search 详情实现，点击后再挂现有 `ChatToolCard` L2。
- `ChatToolCard` / `tool-card-*`
  - 降为 L2 详情 owner；默认路径不再要求每条都以重卡片出现。

### 建议的 view model 扩展（第一阶段可渐进）

```ts
type ChatToolActivityFamily =
  | "read" | "edit" | "search" | "bash" | "web" | "agent" | "panel" | "other";

type ChatMessageProcessSummaryViewModel = {
  /** 最终展示给用户的一行摘要 */
  label: string;
  /** 可选：结构化片段，便于测试与后续富渲染 */
  segments?: Array<{
    family: ChatToolActivityFamily;
    count: number;
    representative?: string;
    tone?: "success" | "error" | "cancelled" | "running";
  }>;
};
```

第一阶段允许 UI 只渲染 `label`；但生成逻辑必须可单测验证“不会产出 Used N tools”。

## 目录组织

- 设计文档：`docs/designs/2026-07-12-chat-tool-activity-semantic-summary.design.md`
- 产品摘要推导：`packages/nextclaw-ui/src/features/chat/features/message/utils/chat-message-process-summary.utils.ts`（扩展）及必要的 `chat-tool-activity-summary.utils.ts`
- 共享展示：`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/`
  - `chat-message.tsx`（L0 壳）
  - 新增轻量 `chat-tool-activity/`（L1 聚合行，可选分文件）
  - 现有 `chat-tool-card.tsx` + `tool-card/*`（L2）
- 类型：`packages/nextclaw-agent-chat-ui/src/components/chat/view-models/chat-ui.types.ts`
- 文案：`packages/nextclaw-ui/src/shared/lib/i18n/locales/*/chat.json`

不新增 store / manager / NCP protocol。  
不把聚合逻辑塞进各个 specialized tool view。

## 兼容与迁移

- 无 tool-card 的历史消息：行为不变。
- 仅有旧版 `processSummary.label = 已处理`：可继续工作；增强后同一字段输出更富语义 label。
- 不改持久化 message；刷新后折叠状态仍按现有策略默认收起。
- panel app / 文件打开 / 子会话 action 保持可用；它们属于 L1 action 或 L2，不因摘要聚合丢失。
- 与 `2026-07-04-chat-completed-process-collapse` 兼容：本设计是其摘要内容与展开层级的增强，不推翻整段折叠机制。

## 验收标准

1. `processSummary` 只显示 `已处理` / `Processed`（可选耗时），**不得**混入工具语义。
2. 连续 ≥2 个 tool-card 折叠为语义组摘要：如 `Read AGENTS.md +2 · Bash pnpm test`。
3. 中间出现 markdown / reasoning / 非 tool part 时，前后工具分成不同组。
4. 单个 tool-card 不建组，直接显示原生卡片。
5. 失败优先出现在工具组摘要中。
6. 展开工具组后，组内仍渲染现有 `ChatToolCard`，能力不回退。
7. streaming 消息不启用 outer `已处理` 总收起；inner 连续工具组仍可工作。
8. 相关 unit 测试覆盖：连续分组合并、文本打断、单卡不合并、失败优先、outer 与 inner 分离。
9. `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` 定向测试、tsc、lint/governance 通过或披露既有阻塞。

## 非目标

- 不把工具语义写进 `processSummary`。
- 不在本轮引入 `Used N tools` 文案。
- 不改 NCP 协议、不新增 run timeline 持久化模型。
- 不重做全部 tool 特化渲染（diff/终端/panel 逻辑保持）。
- 不做跨刷新记忆展开状态。
- 不在本轮统一全站 hover token（独立议题）。
- 不追求像素级复刻 Claude Code 终端皮肤。

## 后续实现顺序

1. **保持 outer processSummary 纯净**  
   `已处理` / 可选 duration，不承载工具族。
2. **实现 inner 连续 tool-card 分组**  
   文本/reasoning 打断；≥2 才成组；语义摘要。
3. **共享 UI 渲染**  
   `ChatMessage` 内用 group block 渲染；展开后复用 `ChatToolCard`。
4. **测试**  
   分组、打断、失败优先、outer/inner 分离。
5. **后续可选**  
   组内再做更轻量 L1 行、视觉进一步降权。

## 风险与取舍

| 风险 | 处理 |
|------|------|
| 与 outer 总收起混淆 | 强制两层分离；验收禁止混写 |
| 族映射不准导致误导 | unknown 进 `other`，宁可保守 |
| 摘要过长 | 最多 3 个族片段 + `+N` |
| 合并后难发现失败 | 失败优先打到组摘要 |
| 过度 CLI 化损害可操作性 | 展开后仍是完整 tool card |

## 推荐落地策略

1. **P0（本轮）**：outer 保持 `已处理`；inner 连续 tool 汇总 + 文本打断  
2. **P1**：组内行级进一步轻量化 / 默认更少重卡片  
