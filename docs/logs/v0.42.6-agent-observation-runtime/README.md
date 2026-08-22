# v0.42.6 Agent Observation Runtime

## 迭代完成说明

本迭代完成 Agent Observation 的首个 Extension Runtime 垂直切片：Extension manifest 声明 `contributes.observations.read/events`，Agent 通过 `bind_context`、`subscribe_events` 和 `manage_observations` 建立、查看与管理持久观察关系。

- Context Binding 在每个模型输入边界通过 Extension RPC 重新读取当前快照，并以低权限数据固定序列化到 Provider 消息绝对尾部。
- Event Subscription 通过 Extension RPC 建立和撤销，支持事件过滤、dedupe、pending/rate budget、cursor 和 queue/prefer-steer，事件仍复用标准 Agent ingress。
- Binding、Subscription、cursor 和有界 EventDelivery envelope 持久化到同一状态事实源；冷重启后恢复关系、Extension lease 和未完成 Delivery。
- Observation Event 在 session journal 中保留 service 来源，但进入模型时投影为不可信 user/data，不获得 system 权限。
- 标准 Agent ingress 增加 session-scoped 幂等准入；临时 ingress 失败保留为可恢复 pending，重启后使用原 key 重投。
- Agent-facing 工具只管理当前 session；跨 session 目标在首版明确拒绝，避免在权限 broker 尚未存在时产生越权关系。

实现按 Context read、Event connection、EventDelivery 三种生命周期拆分，共享一个 Store，复用 Extension discovery/lifecycle/Ingress，不增加 Kernel-local Source catalog、namespace、pipeline/DSL、第二套 scheduler 或外部 Runtime 兼容层。

## 测试/验证/验收方式

本次提交前完成的是定向验证，而不是全仓库收尾验证：

- Kernel 定向 Extension Runtime/Observation 测试：6 个文件、16 个测试通过。
- Kernel 定向 Observation、幂等和 Provider 测试：4 个文件、8 个测试通过。
- Extension SDK Observation 测试：1 个文件、2 个测试通过。
- `@nextclaw/kernel`、`@nextclaw/extension-sdk`、`@nextclaw/ncp-agent-runtime-next` 的 TypeScript 检查通过。
- Kernel、Extension SDK、Native Runtime 定向 lint 无错误；Kernel 有 3 个既存 warning，Native Runtime 有 2 个 warning。
- `git diff --check` 通过；观察相关旧 `ContextSource`/`EventSource`/`ObservationManager.register`/`sourceId` 搜索未发现残留（无关 Panel App `sourceId` 除外）。
- 维护性门禁仍有 2 个错误：`agent-runtime.service.ts` 超过 600 行预算且 `run` 方法超过函数预算；因此不能把本轮表述为维护性全绿，也没有声称全量测试通过。

## 发布/部署方式

本轮只完成本地源码、测试、设计记录和 changeset，没有提交、推送、发布或部署。后续由统一发布流程消费 `.changeset/agent-observation-runtime.md`。

## 用户/产品视角的验收步骤

1. 安装一个声明 `contributes.observations.read/events` 的 Extension，并提供对应 SDK handlers。
2. 在 Native Agent session 中通过 Observation 工具调用 `bind_context` 与 `subscribe_events`。
3. 发送普通消息，确认模型输入最后一段包含最新 Context Tail，稳定会话历史仍位于它之前。
4. 让 Extension 发出满足 admission 的事件，确认空闲时启动、运行中排队或 prefer-steer，并且模型只把事件当作不可信数据。
5. 终止并重建 Kernel，确认关系 ID、cursor、Extension lease 和 pending Delivery 保留；下一次用户输入读取新快照而不是旧快照。
6. 删除 session，确认对应 Extension subscription 关闭且 Binding、Subscription 和 Delivery 清理。

## 可维护性总结汇总

- 自动维护性检查本轮仍有 2 个错误：`agent-runtime.service.ts` 文件超过 600 行预算，且 `run` 方法超过函数预算；另有 12 个 warning。
- Observation 的 Context/Event/Delivery 已拆为三个真实生命周期 service 和一个薄 Manager；观察相关新文件未触发硬预算错误。
- `AgentRunRequestManager`、runtime run 观察、幂等准入和 session summary/settings 已沿真实职责缝拆出；Native runtime 的 `agent-runtime.service.ts` 仍需后续独立拆分。
- 维护性门禁未宣称通过；本次 commit 保留该残余风险，避免用空壳模块规避预算。

## NPM 包发布记录

需要随后续统一版本发布，但本轮未发布：

- `@nextclaw/kernel`：minor，待统一发布。
- `@nextclaw/ncp`：minor，待统一发布。
- `@nextclaw/ncp-agent-runtime-next`：patch，待统一发布。

当前工作区还有其它任务的 changeset 和 package 变更，发布时必须由交付流程重新核对精确范围，不能把本记录视为发布授权。
