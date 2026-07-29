# v0.26.35 Codex NARP 会话连续性修复

## 迭代完成说明

- 根因一是 Codex app-server 会持续发送 `item/commandExecution/outputDelta`，但 Codex NCP adapter 没有把它映射成 NCP 工具输出活动，NARP wrapper 也没有对应的 ACP `tool_call_update` 输出，因此 host 侧只看见长时间无 ACP update，把仍在输出的长命令误判为 idle timeout。
- 根因二是通用 stdio runtime 在 timeout 后根据 `resetSessionMetadataOnPromptTimeout` 生成 `codex_thread_id: null`，kernel 随后持久化该 patch；RunError 销毁 runtime 后，下一轮因 metadata 中已没有 thread ID 而执行 `thread/start`，把一个 NextClaw 产品会话拆成多个 Codex thread。
- 根因通过故障 journal 的 120 秒活动间隔、Codex app-server 官方通知合同、adapter 通知分支、stdio timeout recovery、kernel metadata ingestion、runtime disposal 与下一轮 `thread/start/thread/resume` 选择的端到端代码证据确认。它不是普通回答漂移，也不是 request timeout 数值太短。
- 修复在协议 owner 中增加通用工具输出增量事件，由 Codex adapter 映射真实 command output，再由 NARP wrapper 映射为 ACP 活动；没有在通用 stdio host 中增加 Codex 特判、伪造文本 heartbeat 或重复结束事件。
- 删除没有合法使用者的 timeout metadata reset 机制、server 透传、installer 配置和旧 recovery 文件。timeout 仍可取消当前 turn、销毁进程/runtime 并明确报错，但不得改写外部会话身份。
- `codex_thread_id` 一旦绑定即不可变；runtime 重建后继续使用同一 ID 执行 `thread/resume`。resume 失败直接报错，不清空 ID，也不 fallback 到 `thread/start`。
- 本次没有修改已受损的真实 session metadata，没有修改用户本机配置，没有通过增大 `requestTimeoutMs` 规避问题。

## 测试/验证/验收方式

- `@nextclaw/ncp`：lint、build、`tsc --noEmit` 通过；lint 仅保留既有 reasoning normalization 警告。
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk`：7 个测试文件、27 个用例通过；lint、build、`tsc --noEmit` 通过，lint 仅保留既有 mapper 警告。
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper`：3 个定向用例及完整 package test、lint、build、`tsc --noEmit` 通过。
- `@nextclaw/nextclaw-ncp-runtime-stdio-client`：2 个测试文件、19 个用例通过；lint、build、`tsc --noEmit` 通过。
- `@nextclaw/server`：3 个定向用例及 package lint、build、`tsc --noEmit` 通过；lint 仅保留既有超长文件等历史警告。
- `@nextclaw/kernel`：9 个 AgentRunRequestManager 定向用例及 package lint、build、`tsc --noEmit` 通过。
- 跨 runtime 审计：Codex NARP 15 个用例、Claude NCP 8 个用例、Claude NARP 7 个用例、Hermes HTTP 10 个用例、Hermes ACP 7 个用例及相应 `tsc` 全部通过。
- 可维护性守卫测试：`node --test .agents/skills/post-edit-maintainability-guard/scripts/maintainability-guard-support.test.mjs` 通过，4 个用例；测试夹具目录不再误计为生产代码。
- `pnpm lint:new-code:governance`：通过；只报告工作区中已有并已备案的 context provider 目录例外，本轮没有新增该目录文件。
- `pnpm check:governance-backlog-ratchet`：通过，source filename backlog `2 <= 81`，doc filename backlog `11 <= 16`。
- 隔离真实源码链路 smoke 使用临时 `CODEX_HOME` 和仓库源码依次运行 stdio client、NARP wrapper、Codex app-server runtime 与本机 Codex 二进制；临时文件和隔离配置已删除，未触碰真实用户 session/config。
- 活跃长命令验收：真实命令总时长超过 60 秒并定期产生 output delta，未触发 timeout；收到工具开始、持续输出、工具结果和最终回答，marker 追问命中，`codex_thread_id` 全程不变。
- 真实 idle timeout 合同验收：绑定 thread 后暂停隔离 NARP 子进程超过 20 秒 idle timeout，事件为明确 `RunError`，没有 `RunMetadata` 身份 reset，原 thread ID 保持不变。
- resume 失败验收：隔离环境注入无效 thread ID 后只得到明确失败；临时 Codex rollout 数量未增加，证明没有 fallback 到 `thread/start`，metadata 中原 ID 不变。
- 剩余真实验收缺口：idle timeout 后的下一轮 marker 恢复追问多次在约 8 秒处收到上游 Codex `Internal error`，更换可用模型仍复现，因此未取得这一步的真实模型回答证据。单元与集成测试已证明 runtime 重建继续收到同一 ID、调用 `thread/resume` 且不调用 `thread/start`，但不把这些替代测试表述成完整真实 smoke。

## 发布/部署方式

- 本次按用户明确要求执行本地 git commit；未 push、未创建 PR、未发布 NPM 包、未触发 runtime update、未部署或重启主实例。
- 不涉及数据库 migration、后端线上部署、Desktop installer、update manifest 或用户配置迁移。
- 当前用户本机若仍保存旧的 `resetSessionMetadataOnPromptTimeout` 字段，升级后的 server/runtime 会忽略并丢弃该遗留配置；本次没有主动改写本机配置。

## 用户/产品视角的验收步骤

1. 在新的 NextClaw Codex 会话中让模型记住随机 marker，记录首次写入的 `codex_thread_id`。
2. 执行总时长超过 idle timeout、但定期输出的安全命令，确认命令完成而不是 timeout，并追问 marker。
3. 制造真正超过 idle timeout 的完全无活动 turn，确认用户收到明确 timeout，同时 session metadata 中原 `codex_thread_id` 未清空、未替换。
4. 下一轮继续发送消息，确认 runtime 重建后恢复同一个 Codex thread，marker 仍可回答。
5. 在隔离环境构造不可恢复的 thread ID，确认用户收到 resume 错误、系统不创建替代 thread。

## 可维护性总结汇总

- 本次修复使用现有协议、Codex adapter、NARP wrapper 与 stdio runtime owner，没有新增 heartbeat、fallback、兼容双路径或 Codex host 特判。
- 正向减债动作是删除危险且无合法使用者的 timeout metadata reset 机制，并把 command output activity 收敛到唯一的 NCP → ACP 工具更新链路；身份合同也从“调用者默认遵守”强化为 runtime 内部不可变校验。
- 测试中的持续活动 agent 已移动到既有 `test-fixtures` owner，被触达的 stdio 主测试文件从历史超限状态降回 lint 预算内。
- `post-edit-maintainability-guard --non-feature`：通过，无阻塞项。提交代码口径总计 `+401/-223，净增 178`；排除测试资产后为 `+81/-140，净减 59`，满足非功能修复不得增加生产语义代码的门槛。
- 趋势警告均已审计：Codex app-server service 为 599/600 行；历史超长的 stdio runtime 与 server config store 本次分别净减 16 行和 1 行；测试文件没有越过 900 行预算。没有新增超限文件、目录、函数或命名职责错配。
- `post-edit-maintainability-review`：通过，`no maintainability findings`。正向减债动作为删除、简化与职责收敛；删除旧 recovery 和配置透传是真实行为收敛，不是压行或把复杂度转移到未计数位置。保留的观察点是 Codex app-server service 接近预算线，后续新增独立通知族时应优先沿通知映射职责拆分。

## 红区触达与减债记录

### packages/nextclaw-server/src/features/config/stores/server-config.store.ts

- 本次是否减债：是。
- 说明：删除仅为危险的 timeout metadata reset 字段保留的敏感配置路径例外；该 store 没有新增分支、状态或抽象。
- 下一步拆分缝：该历史超长 store 后续可按配置读取、敏感值投影和持久化写入三个职责拆分；本次不扩大范围，以免混入与会话连续性无关的结构重构。

## NPM 包发布记录

- `@nextclaw/ncp@0.7.14`：已加入 patch changeset，新增通用工具输出增量事件，待统一发布。
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.2.14`：已加入 patch changeset，补齐命令输出活动和不可变 thread 身份，待统一发布。
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper@0.3.15`：已加入 patch changeset，将工具输出增量映射为 ACP activity，待统一发布。
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.17`：已加入 patch changeset，删除 timeout 身份 reset 机制，待统一发布。
- `@nextclaw/server@0.15.18`：已加入 patch changeset，停止保存和展示遗留 reset 配置，待统一发布。
- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.2.15` 与 `nextclaw@0.27.6`：本次没有属于该问题的直接源码改动或独立 changeset；统一发布时需随上述 workspace 依赖评估联动升级。
- 本轮未执行任何 NPM publish、tag、GitHub Release 或 runtime update。
