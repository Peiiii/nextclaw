# v0.16.53-native-tool-abort-status-alignment

## 迭代完成说明

本次修复 Native 会话在工具执行中手动终止时的状态收敛问题，目标是让 UI 行为与用户心智保持一致，而不是在终止后额外长出一张 `unknown` 工具卡。

- 为 NCP `tool-invocation` 增加 `cancelled` 状态语义，用于表达“工具已被终止，未产出结果”
- 在会话状态管理器收到 `MessageAbort` 时，把当前消息里仍在执行中的工具调用直接收敛为 `cancelled`
- 对 abort 之后迟到的同一工具尾事件做忽略处理，避免它们重新造出 `unknown` 工具卡，或把原工具卡错误地保持在“执行中”
- 为 NCP -> UI 适配补上 `cancelled` 状态映射，让前端直接把该工具卡渲染为取消态
- 补充回归测试，覆盖“工具执行中终止”和“取消态工具卡渲染”两个关键场景

## 测试/验证/验收方式

已执行：

- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit test -- src/agent/agent-conversation-state-manager.test.ts src/agent/__tests__/agent-conversation-state-manager.abort-tool.test.ts`
- `pnpm -C packages/nextclaw-ui test -- src/components/chat/ncp/ncp-session-adapter.test.ts src/components/chat/ncp/__tests__/ncp-session-adapter.cancelled-tool.test.ts`
- `pnpm -C packages/ncp-packages/nextclaw-ncp tsc`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit tsc`
- `pnpm -C packages/nextclaw-ui tsc`

补充说明：

- `pnpm lint:maintainability:guard` 的 maintainability report 已恢复到无 error，仅余 warning
- 该命令后续的 `pnpm lint:new-code:governance` 被当前工作树里一处与本次修复无关的已触碰文件阻断：
  `packages/nextclaw-ui/src/components/common/BrandHeader.tsx`
  原因是该文件名本身不是 kebab-case，属于本次修复之外的分支内现存治理阻塞

## 发布/部署方式

本次改动不涉及单独的数据迁移或发布脚本。

- 随常规 NextClaw 前端 / Native 会话相关包发布即可
- 若走发布前校验，需先处理当前工作树里与本次修复无关的 `BrandHeader.tsx` 命名治理阻塞，再跑全量治理校验

## 用户/产品视角的验收步骤

1. 打开 Native 会话，触发一个耗时工具调用，例如文件写入或绘画类工具
2. 在工具卡仍处于执行中时点击“终止”
3. 观察当前这张工具卡：
   应从“执行中”收敛为“已取消/Cancelled”语义，而不是继续停留在 running
4. 继续观察消息列表：
   不应再额外出现一张标题或名称为 `unknown` 的工具卡
5. 若运行时还有迟到的工具尾事件返回：
   UI 也不应把原工具卡重新改回“执行中”，也不应补出第二张卡

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

本次改动顺着“统一体验更可预测、状态边界更清晰”的长期方向推进了一小步。修复前，用户点击终止后会看到“原工具仍在执行中 + 新长出一张 unknown 卡片”的双重错乱状态；修复后，终止动作直接收敛到原工具卡自身，并明确表达为 `cancelled`，更符合 NextClaw 作为统一入口时应提供的稳定、自然、可理解体验。

本次顺手减债：是。

- 没有继续在 UI 层叠加兜底显示逻辑，而是把问题收回到 NCP 工具状态语义与会话状态管理器收敛点
- 把“中断中的工具状态归并”抽到 `agent-conversation-state-manager.utils.ts`
- 新增回归测试拆到 `__tests__/` 子目录，避免继续放大原有超长测试文件
- `agent-conversation-state-manager.ts` 在新增行为后反而从 716 行收敛到 701 行，没有继续恶化

### 可维护性复核结论

- 可维护性复核结论：通过
- 本次顺手减债：是

### 代码增减报告

- 新增：192 行
- 删除：32 行
- 净增：+160 行

### 非测试代码增减报告

- 新增：48 行
- 删除：32 行
- 净增：+16 行

### 可维护性总结

- no maintainability findings
- 这次是非新能力型修复，非测试代码净增控制在 `+16` 行，已经先通过删除旧行、下沉 util、避免 UI 补丁式兜底把增长压到了较小范围
- 剩余增长的最小必要性在于：必须同时补足协议语义、abort 收敛点和 UI 状态映射，缺一都会留下“running 不收敛”或“unknown 卡片复现”的漏洞
- class / helper / service / store 边界没有新增补丁层；复杂度主要集中在既有会话状态 owner 内部，并通过 util 抽离避免继续膨胀
- 目录结构本次满足当前变更的最小需要；未进一步拆 `agent-conversation-state-manager.ts` 为更细模块，是因为这次目标是先修正终止态契约，避免把一个小修复扩成大范围重组。下一步如果继续沿工具生命周期治理扩展，应从该状态管理器的 tool 子域拆分开始
- `pnpm lint:maintainability:guard` 无新增 error；后续全量治理仍受工作树里与本次无关的 `BrandHeader.tsx` 命名问题阻断，因此本次将其记录为外部阻塞，不把它伪装成本次修复未完成
