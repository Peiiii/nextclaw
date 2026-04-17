# v0.16.42-chat-tool-card-header-truncation

## 迭代完成说明

本次修复了聊天消息里工具调用卡片 header 的长参数截断异常。

- 根因不是后端没有裁剪，也不是摘要文本缺少 `truncate`，而是 header 左侧文本区用 `max-w-[calc(100%-80px)]` 这种固定预留宽度给右侧操作区“猜空间”。
- 第一条卡片之所以看起来正常，只是因为右侧状态区刚好没有把这 80px 预算打满；后面两个卡片在存在更宽的状态/动作区时，左侧会继续按错误预算排版，导致文本钻到右侧图标下面，而不是触发省略号。
- 现在改成了真正的 flex 剩余空间布局：
  - 左侧文本区改为 `min-w-0 flex-1 overflow-hidden`
  - 文本与 summary 容器也同步收成 `min-w-0 flex-1 overflow-hidden`
  - 右侧状态/动作区继续 `shrink-0`
- 这样无论右侧区域实际占多少宽，左侧都只使用剩余空间，超出部分统一走 `truncate`。
- 同时新增了一个回归测试，专门覆盖“header 有 actionSlot 且 summary 很长时，summary 仍处在可收缩的 flex lane 中”的场景。

同批次补充修正（输入栏错误展示收敛）：

- 发送区的 `sendError` 以前会把完整错误正文直接平铺在输入栏右侧；一旦上游返回长 `stderr` / 长 HTTP 错误，底部输入区会被整块红字撑开。
- 现在改成“默认摘要 + 完整详情按需查看”：
  - 默认只展示压缩后的单行错误摘要，避免输入区被大段报错挤坏。
  - `Details` 入口固定可见，不再依赖“是否被判定为超长”才出现，避免中等长度错误或隐藏换行错误没有查看原文入口。
  - 完整错误仍然保留原始换行与内容，排障信息没有被删除，只是从默认主视图里挪到了二级层。
- 同时补了两条回归测试，分别覆盖“长错误默认折叠、点击后可查看完整正文”以及“错误存在时总能拿到原文入口”的行为。

## 测试 / 验证 / 验收方式

已执行：

```bash
pnpm -C packages/nextclaw-agent-chat-ui test -- --run src/components/chat/ui/chat-message-list/tool-card/tool-card-header.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.generic-tool.test.tsx src/components/chat/ui/chat-message-list/chat-message-list.test.tsx
pnpm --filter @nextclaw/agent-chat-ui exec vitest run src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx
pnpm -C packages/nextclaw-agent-chat-ui tsc
pnpm exec eslint packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/tool-card/tool-card-header.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/tool-card/tool-card-header.test.tsx
pnpm -C packages/nextclaw-agent-chat-ui lint
pnpm lint:maintainability:guard
```

结果：

- 定向 Vitest 通过，`3` 个测试文件、`21` 条测试全部通过。
- 输入栏错误折叠的定向 Vitest 通过，`1` 个测试文件、`17` 条测试全部通过。
- `tsc` 通过。
- 本次触达的两个文件定向 ESLint 通过。
- 包级 `pnpm -C packages/nextclaw-agent-chat-ui lint` 未通过，但失败项都来自当前包内其它历史文件，与本次 header 截断修复无关；本次改动文件本身没有新增 lint 问题。
- `pnpm lint:maintainability:guard` 未通过，但这次阻塞点来自当前工作区其它并行触达类上的历史治理问题（`SessionSearchStoreService` 的 class method arrow 规则），不涉及本次新增/修改的输入栏错误折叠文件；本次修复本身没有新增守卫命中项。

## 发布 / 部署方式

本次无需单独发布脚本。

若要让本地开发态看到修复结果：

1. 重启或刷新承载 chat UI 的前端页面。
2. 重新触发一组带长路径/长命令参数的工具调用卡片。
3. 观察 header：长参数应在右侧状态/展开区之前被省略，并显示 `...`，不再穿到图标下面。
4. 触发一次明显较长的发送错误（例如长 `stderr`、长 404/鉴权错误）。
5. 观察输入栏右侧：默认应只看到一行摘要，不再被整段红字撑开；无论错误长短，`Details` 都应可见，点击后可查看完整错误原文。

## 用户 / 产品视角的验收步骤

1. 在聊天里触发至少三条工具调用，其中后一两条使用明显更长的路径或命令参数。
2. 观察卡片首行，确认右侧勾选/展开按钮区域不再覆盖文本。
3. 确认长参数会在可用宽度内自动省略，而不是横向顶出。
4. 展开 generic 工具卡片，确认完整参数仍可在正文区查看，没有因为 header 截断而丢失信息。
5. 故意选择一个无效模型或制造一条长错误，确认输入栏只显示错误摘要。
6. 点击 `Details`，确认完整错误正文会在 popover 中展示，关闭后输入栏布局恢复紧凑。
7. 若鼠标停留在红字摘要上，浏览器原生 title 也应保留完整原文，作为额外兜底查看入口。

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

是。

这次修复顺着“统一入口下的统一体验”推进了一小步：工具调用卡片的 header 不再依赖脆弱的像素猜测，而是回到更可预测的布局约束。它减少了 UI 在不同工具状态下出现偶发错位的概率，也让同一类卡片在不同动作组合下保持一致行为。

### 可维护性复核结论

通过。

### 本次顺手减债

是。

- 删除了固定 `80px` 预留宽度这类脆弱布局假设。
- 没有新增新的截断 helper、没有补第二套“专门给某些工具卡片”的样式分支，而是直接把 header 主布局收成通用剩余空间模型。
- 输入栏错误区也没有再把完整错误硬塞回主布局，而是把“默认看摘要、需要时看全文”收成单一规则。
- no maintainability findings

### 代码增减报告

- 新增：39 行
- 删除：3 行
- 净增：+36 行

### 非测试代码增减报告

- 新增：3 行
- 删除：3 行
- 净增：0 行

说明：

- 本次总代码净增几乎全部来自新增回归测试。
- 非测试代码已做到最佳删减：通过替换布局约束而不是叠加额外逻辑，业务代码实现层面没有继续膨胀。

### 删减优先 / 简化优先判断

是。

这次没有为了修视觉 bug 再补一层字符串裁剪逻辑，也没有按工具类型分别加特判，而是直接删掉错误的固定宽度假设，用更简单的 flex 剩余空间规则统一解决。

### 代码量 / 分支数 / 函数数 / 文件数 / 目录平铺度判断

总体可接受，且非测试代码没有继续恶化。

- 代码实现层没有新增分支、没有新增 helper、没有新增额外抽象层。
- 文件数净增 `1` 来自回归测试文件，属于最小必要增长。

### 抽象与职责边界判断

更合适、更清晰。

- header 仍然只负责 header 自己的布局，不把“右侧有多少按钮”这种细节外溢成调用方需要配合的固定宽度知识。
- 测试只校验“summary 仍位于可收缩的 flex lane 中”这个布局契约，没有把业务行为拆散到别处。
- 输入栏错误展示也仍然收敛在 `ChatInputBarActions` 内部，没有把预览/详情逻辑扩散到 presenter、store 或额外 helper 文件。

### 目录结构与文件组织判断

满足当前项目治理要求。

- 改动仍然收敛在现有 `tool-card/` 目录内。
- 新增测试文件与被测组件同目录放置，没有继续扩大平铺范围。

### 补充续改维护性复核（输入栏错误摘要）

- 可维护性复核结论：通过
- 本次顺手减债：是
- 代码增减报告：
  - 新增：126 行
  - 删除：14 行
  - 净增：+112 行
- 非测试代码增减报告：
  - 新增：85 行
  - 删除：14 行
  - 净增：+71 行
- 可维护性总结：
  - 这次净增长主要来自把“长错误压缩为摘要 + popover 详情”收进输入栏动作组件，以及对应回归测试；虽然非测试代码有净增，但已经避免了额外 manager/store/独立弹窗层的扩散，增长点基本都落在同一个 owner 组件里。
  - 删除层面，这次没有可直接清掉的旧抽象，但已经把“整段错误直出”这种高噪声行为替换为更可预测的单一路径。下一条维护性观察线是：如果后续输入栏继续堆叠细节按钮，应考虑把错误/提示类二级展示统一为一个更稳定的小型 slot，而不是继续在 actions 里零散增长。
