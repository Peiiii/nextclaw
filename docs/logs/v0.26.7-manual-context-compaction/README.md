# v0.26.7 手动压缩会话上下文

## 迭代完成说明

- 会话输入框新增“压缩上下文”斜杠命令，用户可以在继续长会话前主动释放上下文预算。
- 命令沿 `UI -> Client SDK -> Server -> Kernel -> AgentRuntime` 单一路径执行，前端不判断 runtime 类型，也不发送伪压缩 prompt。
- Native runtime 复用既有 checkpoint、摘要、metadata patch 与 timeline message；Codex app-server runtime 调用官方 `thread/compact/start`。
- 会话正在运行、runtime 不支持、会话不存在或 Native 历史不足时返回明确错误，不静默成功、不自动 fallback。
- 方案与 owner 证据沉淀在 `docs/designs/2026-07-20-manual-context-compaction.design.md`。
- 2026-07-24 follow-up 修复首次交付的验收缺口：此前 UI 只在请求结束后显示 toast，请求进行期间消息区没有任何反馈；现在 conversation area 按会话持有瞬态状态，消息时间线立即显示“正在压缩上下文”，完成或失败后清理，最终压缩事实仍只来自 kernel timeline。
- 根因通过挂起 `compactNcpSessionContext` 请求复现：请求已开始但用户可见状态回调为零；修复补齐 slash command 请求生命周期到 conversation timeline 的状态链路，而不是增加延迟 toast 或伪造持久化消息。

## 测试/验证/验收方式

- Kernel 定向测试：4 个文件、22 个用例通过，覆盖 manual trigger、历史不足、busy、unsupported、事件应用与发布。
- Server assembled route 测试：5 个用例通过，覆盖成功 envelope 与四类领域错误映射。
- Codex runtime 测试：相关 package 全部 7 个文件、20 个用例通过，覆盖 thread 恢复后调用 `thread/compact/start`。
- UI hook 测试：3 个用例通过，覆盖命令可见、选中会话调用、成功/失败反馈与重复点击保护。
- 2026-07-24 follow-up：4 个 UI 定向测试文件共 38 个用例通过，新增覆盖挂起请求期间的可见状态、conversation 会话隔离、消息时间线进行中反馈及完成后清理；`@nextclaw/ui` 精确 `tsc --noEmit` 通过。
- Client SDK 测试：1 个用例通过，覆盖 method、URL 与返回 shape。
- `@nextclaw/ncp`、Kernel、Server、Client SDK、UI 与 Codex runtime 六个包的精确 `tsc` 全部通过；六个包 lint 为 0 error，仅报告与本次改动无关的既有 warning。

## 发布/部署方式

- 新增 `.changeset/add-manual-context-compaction.md`，标记受影响的 NCP、Kernel、Server、Client SDK、UI 与 Codex runtime package patch。
- 本次只提交并尽量 fast-forward 合入本地 `master`；不 push、不建 PR、不发布 NPM 包、不部署、不执行 migration，也不重启现有 NextClaw 实例。

## 用户/产品视角的验收步骤

1. 打开一个已有多轮历史的会话，在输入框输入 `/`。
2. 选择“压缩上下文”，确认界面提示压缩成功，且没有额外发送一条用户消息。
   请求尚未结束时，消息时间线应立即显示“正在压缩上下文”；成功或失败后该进行中反馈消失。
3. 对 Native runtime 确认会话时间线出现既有压缩 checkpoint 消息，后续对话继续使用压缩后的上下文。
4. 对 Codex app-server runtime 确认原 thread 保持不变，压缩后可以继续同一会话。
5. 在会话正在生成回复、runtime 不支持或历史不足时，确认界面显示具体失败原因而不是成功提示。

## 可维护性总结汇总

- 本次是新增用户能力，允许必要的生产代码增长；核心复用既有 Native 压缩算法与 NCP runtime owner，没有复制摘要算法或建立 prompt fallback。
- 会话级并发和 capability 判断收敛到 `SessionContextCompactionManager`；HTTP controller 只负责状态映射，UI 只消费统一 action API。
- 原本内联在会话输入组件的产品斜杠命令组装被提取到 conversation hook，输入组件职责和行数同步下降。
- 没有新增 React effect、runtime 类型分支、deep import、平行消息通道或自动重试路径。
- Follow-up 复用既有 compaction divider 和 i18n 文案；瞬态请求状态与持久化完成事实边界明确，没有新增第二套消息协议。
- Maintainability guard 检查 28 个文件：总代码 `+715 / -26 / 净增 689`，非测试代码 `+302 / -25 / 净增 277`；这是新增用户能力所需的跨层合同、owner 与消费链路增长。闸门为 0 error，5 个 warning 均为既有目录预算或临近文件预算，本次还让会话输入组件净减少 15 行。
- 新增代码治理、governance backlog ratchet、generated-clean 与 `git diff --check` 均通过；主观复核结论为 owner 清晰、单一路径成立、没有可删除的平行实现。

## NPM 包发布记录

- `@nextclaw/ncp`：需要 patch，发布可选 runtime context compaction capability，待统一发布。
- `@nextclaw/kernel`：需要 patch，发布会话级 compaction owner 与 Native 手动触发路径，待统一发布。
- `@nextclaw/server`：需要 patch，发布 session context compact API 与错误映射，待统一发布。
- `@nextclaw/client-sdk`：需要 patch，发布 sessions context compact client method，待统一发布。
- `@nextclaw/ui`：需要 patch，发布斜杠命令与用户反馈，待统一发布。
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk`：需要 patch，发布 Codex app-server `thread/compact/start` capability，待统一发布。
- Changeset：`.changeset/add-manual-context-compaction.md`。
- 本次未执行 NPM 发布。
- 2026-07-24 follow-up 新增独立 UI patch changeset；仍未执行 NPM 发布。
