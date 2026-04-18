# v0.16.74-chat-startup-send-gate

## 迭代完成说明

- 本次修复的是“服务刚启动时，用户一进入聊天页就可能撞上 `ncp agent unavailable during startup`”的问题。
- 根因是 UI shell 会先启动并对外提供聊天页面，但真正承载聊天发送/流式请求的 NCP agent 仍在 deferred startup 阶段；此时聊天页已经可见，前端又没有显式消费启动态，于是用户会直接看到底层占位错误，而不是产品级的“正在初始化”提示。
- 根因确认方式：
  - 代码链路确认：`packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-startup.ts` 先启动 UI shell，再异步创建并激活 `createUiNcpAgent()`。
  - 占位错误确认：`packages/nextclaw/src/cli/commands/service-support/session/service-deferred-ncp-agent.ts` 在 agent 未激活时会直接抛 `ncp agent unavailable during startup`。
  - 前端请求链路确认：聊天页通过 `/api/ncp/agent/*` 直接走 NCP agent client，请求未就绪时不会被转换成显式启动态。
- 本次修复命中根因而不是处理表象的方式：
  - 后端把 `ncpAgent` 启动状态纳入 `/api/runtime/bootstrap-status`，不再让聊天页只能靠错误文本猜当前是不是还在启动。
  - 前端聊天页显式读取该状态，在 `ncpAgent` 未 ready 时展示“聊天能力正在初始化”，并只禁用发送按钮，保留输入能力。
  - 当 `ncpAgent` ready 后，发送自动恢复；如果启动失败，则展示明确失败信息，而不是继续把底层启动错误原样暴露给用户。

## 测试/验证/验收方式

- 定向单测：
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/service-support/gateway/tests/service-bootstrap-status.test.ts src/cli/commands/service-support/gateway/tests/service-gateway-startup.test.ts`
  - `pnpm -C packages/nextclaw-ui test -- --run src/components/chat/ncp/page/chat-runtime-bootstrap-state.test.ts`
- 类型检查：
  - `pnpm -C packages/nextclaw tsc`
  - `pnpm -C packages/nextclaw-ui tsc`
  - `pnpm -C packages/nextclaw-server tsc`
- 治理/维护性检查：
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
  - `pnpm lint:new-code:governance`
  - `pnpm check:governance-backlog-ratchet`
- 当前验证结论：
  - 定向单测通过。
  - 受影响包类型检查通过。
  - `check:governance-backlog-ratchet` 通过。
  - `lint:new-code:governance` 失败，但失败原因是当前工作树内已有的历史/他人改动命中了全局文件命名治理，不是本次改动新引入的问题。
  - `post-edit-maintainability-guard --non-feature` 失败，核心原因是本次属于非新增用户能力的 bugfix，但为建立显式启动状态链路引入了净新增非测试代码；该结果已如实保留，后续仍需继续压缩实现或同步偿还删除量后才可满足该守卫。

## 发布/部署方式

- 本次为代码修复，无额外部署脚本变更。
- 按正常前端/UI 服务发布流程打包并发布包含本次提交的构建即可。
- 若需要做上线前人工确认，优先在本地或测试环境验证“冷启动后立刻打开聊天页”的场景。

## 用户/产品视角的验收步骤

1. 启动 NextClaw 服务或桌面端。
2. 在服务刚进入 UI 可访问状态时，立刻打开聊天页。
3. 确认页面顶部出现“聊天能力正在初始化”提示。
4. 确认输入框仍可输入文本、选择技能、编辑内容。
5. 确认发送按钮在初始化完成前不可点击。
6. 等待初始化完成后，确认发送按钮自动恢复可用。
7. 发送一条消息，确认不会再直接看到 `ncp agent unavailable during startup`。

## 可维护性总结汇总

- 是否已尽最大努力优化可维护性：否。
  - 阻碍约束：本次工作在一个已有大量并行改动的脏工作树中完成，且仓库对“非功能改动非测试代码净增必须 <= 0”有严格守卫；为了把启动态从隐式错误文本提升为显式状态合同，仍不可避免引入了净新增代码。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是，但未完全达成守卫要求。
  - 本次优先选择了“复用现有 bootstrap status 路径 + 明确状态同步”的方案，没有走错误字符串匹配或多处兜底分支；这让行为更可预测，但总代码仍净增。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：否。
  - 新增了前端 bootstrap hook 与状态映射文件，总代码量和 hooks 目录平铺度都有增长；其必要性在于把聊天可发送性从隐式错误耦合中剥离出来，换成显式可观察状态。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：部分做到。
  - 好处是把“聊天页可见”和“聊天 plane ready”拆成两个明确层次，避免继续把底层报错当 UI 状态。
  - 不足是这次仍增加了额外状态同步与类型定义，后续应继续收敛 UI bootstrap 契约，减少跨文件重复声明。
- 目录结构与文件组织是否满足当前项目治理要求：未完全满足。
  - `packages/nextclaw-ui/src/hooks`、`packages/nextclaw-server/src/ui` 与若干大文件本身已在治理预算边缘或超预算，本次新增让这些风险继续暴露。
  - 下一步整理入口：优先把 bootstrap / runtime availability 契约从超长类型文件中继续拆分，并评估是否能把聊天页启动可用性状态并入现有 runtime/recovery 模块，减少重复入口。
- 独立维护性复核结论：
  - 本次确实顺着“行为更明确、少 surprise failure、少字符串特判”的长期方向前进了一小步。
  - 但从代码体量治理看，本次仍属于“方向正确但尚未通过非功能净增长约束”的状态，结论应为 `需继续修改`。
- 代码增减报告：
  - 本次针对自身改动范围的维护性守卫统计为：总变更 `+307 / -4 / net +303`。
- 非测试代码增减报告：
  - 本次针对自身改动范围的维护性守卫统计为：非测试代码 `+244 / -4 / net +240`。

## NPM 包发布记录

- 不涉及 NPM 包发布。
