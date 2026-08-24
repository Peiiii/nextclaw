# 子会话上下文与模型连续性修复

## 迭代完成说明

- 修复子会话刚打开就重复展示父会话历史“较早上下文已自动压缩”标记的问题。实际故障会话 `ncp-mt7ex0fl-992e1c7d` 的投影包含 98 条继承消息、1 条本地用户消息和 5 条继承压缩记录；子会话自身没有发生压缩。
- 压缩标记根因是消息气泡过滤已经隐藏继承消息，但压缩时间线解析器独立读取 service message，没有排除带 `inherited_from_session_id` 的父会话记录。修复在压缩时间线语义 owner 处拒绝继承记录，因此父会话 checkpoint 仍保留在 journal 和模型上下文中，子会话界面只展示自己的压缩事件。
- 修复子会话发送消息后长期停留在“Agent 正在思考”的问题。实际运行记录显示子会话保存了父会话模型 `codex-sub/gpt-5.6-sol`，恢复已有 session 时却只读取 `metadata.model`，漏掉 `metadata.preferred_model`，随后错误回退到默认 `minimax/MiniMax-M3` 并连续收到 Token Plan 额度 429。
- 模型连续性修复落在 `SessionManager` 的已有 session identity 映射：显式 `model` 保持最高优先级，缺失时读取继承的 `preferred_model`。下游继续使用既有 `request model → session model → config default` 单一路径，不为具体 provider 或模型添加特判。
- 两项修复都通过真实 catalog、journal、消息投影和运行事件确认，并由失败优先回归测试锁定；不是隐藏 spinner、删除父会话上下文或限制重试次数等症状补丁。

## 测试/验证/验收方式

- UI 最终定向测试：1 个测试文件、9 项通过；扩展相关测试为 3 个文件、16 项通过。覆盖 5 条继承压缩记录不显示，以及子会话自己的后续压缩仍正常显示。
- Kernel 最终定向测试：2 个测试文件、3 项通过；扩展相关测试为 3 个文件、20 项通过。覆盖已有 session 从 `preferred_model` 恢复模型、请求 run spec 使用 session model，以及不读取完整 canonical messages。
- `pnpm -C packages/nextclaw-ui tsc` 与 `pnpm -C packages/nextclaw-kernel tsc` 均通过。
- 定向 ESLint、`git diff --check` 和 changeset 解析通过。
- diff-only maintainability 检查为 0 error、1 个既有预算 warning：`session.manager.ts` 为 606 行，修复前后行数不变，没有新增 finding。
- 未重新执行原始带写权限的子任务，避免再次触发真实外部操作；运行链路通过真实故障数据、fresh-object 测试和 run-spec 合同测试验证。

## 发布/部署方式

- 本提交只进入本地 `master`，不执行 push、NPM 发布、Desktop 发布、部署或宿主重启。
- 后续由统一稳定版发布流程消费 changeset；本批次不改动运行实例或 update channel。

## 用户/产品视角的验收步骤

1. 从已经发生过一次或多次上下文压缩的父会话创建继承上下文的子会话。
2. 打开子会话，确认只出现一次“已继承父会话上下文”提示，不重复展示父会话历史压缩标记。
3. 在子会话内继续发送消息，确认实际运行模型继承父会话当前选择，而不是回退到全局默认模型。
4. 若子会话自身后续触发上下文压缩，确认它自己的压缩标记仍按时间线正常展示。

## 可维护性总结汇总

- 修复分别落在压缩时间线解析 owner 与 session runtime identity owner，没有在组件层、spinner 层或 provider 层增加补偿分支。
- 保持 `metadata.model` 的显式覆盖语义，只增加 `preferred_model` 回退；继承压缩记录仍保留在数据与模型链路，只从不属于它的本地 UI 时间线排除。
- 没有新增 wrapper、service、manager 或平行状态；新增代码主要是贴近真实故障形态的回归测试，目录与文件角色保持不变。
- 自动检查未发现新增维护性错误；唯一文件预算 warning 是既有债务且本次没有扩大。

## NPM 包发布记录

- 需要发布：是。原因是本次修复改变用户可见的子会话时间线和运行模型选择行为。
- 本 changeset 的精确包集合：`@nextclaw/kernel`（patch）、`@nextclaw/ui`（patch）。仓库现有其它未发布 changeset 会使统一发布时的聚合 bump 当前表现为 minor，本记录不把其它批次归入本修复。
- 当前状态：待统一发布；本提交不执行 publish。发布后应补充精确版本、dist-tag 与公开回读结果。
