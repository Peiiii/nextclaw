# v0.26.73 当前会话模型标识

## 迭代完成说明

- 根因：模型切换已经正确写入 session metadata，并进入本轮 `effectiveModel`；但 `CurrentSessionContextProvider` 只向 system context 提供 Channel、Chat ID、Session 和 Thinking，没有提供本轮实际模型。完整历史消息中的旧模型自述仍会随下一轮输入发送，模型因此可能继续沿用旧身份；当它再读取全局默认配置时，还会把默认 M3 错当成当前会话模型。
- 确认方式：用户报告会话的当前 session metadata、run spec 与 `ai_execution` 都指向 `opencode/big-pickle`，而更早的助手消息自述为 MiniMax-M3；代码链路确认请求/会话模型优先于全局默认，并确认最终模型输入包含完整历史和缺少模型字段的 Current Session block。
- 修复：复用现有 `runContext.effectiveModel`，在 `## Current Session` 中直接增加 `Model: <provider/model>`。不新增模型解析、身份推断、fallback、兼容分支或额外解释规则。
- 这是根因修复而不是症状补丁：当前执行模型事实由已经完成路由解析的 run context 单一提供，并在模型输入边界显式交付；没有针对 MiniMax-M3 或 `big-pickle` 写特判。

## 测试/验证/验收方式

- 修前基线使用用户现有会话 artifact，没有主动再发消息复现：再次调用真实模型会污染用户会话并产生外部调用成本；现有 session/run/message 证据已直接冻结“实际执行模型已切换、system context 未提供模型、历史仍保留旧模型自述”这三个观察点。
- `pnpm preflight:governance -- packages/nextclaw-kernel/src/contributions/context-provider/providers/current-session-context.provider.ts packages/nextclaw-kernel/src/contributions/context-provider/providers/context-provider-contract.provider.test.ts`：通过。
- `pnpm -C packages/nextclaw-kernel exec vitest run src/contributions/context-provider/providers/context-provider-contract.provider.test.ts`：1 个测试文件、3 个测试通过。合同测试将全局默认和 agent profile 设为 `minimax/MiniMax-M3`，会话模型保留为 `openai/gpt-5`，最终 Current Session block 必须包含 `Model: openai/gpt-5`。
- `pnpm -C packages/nextclaw-kernel tsc`：通过。
- `pnpm -C packages/nextclaw-kernel lint`：0 个错误；保留 2 个来自用户当前未提交文件的既有 warning，本次两个目标文件 targeted ESLint 通过且无输出。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <本次两个目标文件>`：0 个错误、1 个已有目录预算 warning；该 provider 目录已有完整豁免说明，本次未新增文件，直接文件数保持 15。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance`：未全绿；失败项来自用户当前未提交的 `packages/nextclaw-core/src/features/agent/services/input-budget-pruner.service.ts` 与 `packages/nextclaw-kernel/src/services/agent-run-model-input-budgeter.service.ts`，均为重复读取 `params.*` 的解构治理问题，不在本次触达范围。此前文件名、目录名、文档名、文件角色、模块结构、公共导入、class/object 方法、入参 mutation、React effect 与 closure owner 检查均已通过。
- `pnpm release:summary -- --json`：识别 `current-session-model-context` patch changeset，发布说明素材错误为 0。
- `pnpm clean:generated` 与 `pnpm check:generated-clean`：通过，生成产物保持干净。
- `pnpm lint:new-code:doc-file-names`、迭代记录六段结构检查与本次 4 个文件的 `git diff --check`：通过。
- 真实 `127.0.0.1:5174` 会话复验暂未执行：本次没有擅自重启 NextClaw 宿主，也没有代用户向原会话再发一条真实模型请求。剩余验收缺口是让运行实例消费最新 kernel 源码后，在同一会话再次切换模型并询问当前模型标识。

## 发布/部署方式

- 已添加 `@nextclaw/kernel` patch changeset，待后续统一发布。
- 本次未提交、未推送、未发布、未部署，也未重启当前 NextClaw 宿主。
- 不涉及数据库 migration、远程 API、前端静态产物或 runtime update channel。

## 用户/产品视角的验收步骤

1. 打开一个已有历史回复的会话，并把模型切换到另一个 provider/model 标识。
2. 继续发送“你当前是什么模型”一类问题。
3. 确认回复依据当前选择的完整 provider/model 标识，不再把全局默认模型或历史回复里的旧模型当成当前模型。
4. 刷新会话后重复发送，确认当前模型标识仍来自该会话的实际选择。

## 可维护性总结汇总

- 可维护性复核结论：通过；no maintainability findings。
- 本次顺手减债：是。可选 Thinking 行改为在同一 prompt 行数组里声明，移除了后置 mutation 分支，主流程更集中。
- 代码增减报告：新增 5 行、删除 6 行、净减 1 行。
- 非测试代码增减报告：新增 2 行、删除 3 行、净减 1 行，满足非功能改动净增不大于 0 的门槛。
- 正向减债动作：简化。模型事实复用现有 `effectiveModel`，没有新增 owner、helper、字段、文件、分支或第二事实源。
- 质量与可维护性提升证明：Current Session 的事实列表直接包含当前模型，模型选择、持久化和运行解析链路均保持原样；修复只落在最终上下文交付 owner。
- 为何不是单纯压缩行数：删除的是数组构建后的 mutation 控制流，替换为同一输出列表中的声明式可选项；没有缩短命名、弱化类型或把复杂度移到其它文件。
- 目录级 warning 为历史 provider 扁平目录预算，已有角色约束豁免，本次文件数未增长；无文件级、函数级、命名职责或红区阻塞项。

## NPM 包发布记录

- `@nextclaw/kernel`：需要 patch 发布；changeset 已添加，当前待后续统一发布。
- 当前未执行 NPM 发布，未评估或变更其它包版本。
