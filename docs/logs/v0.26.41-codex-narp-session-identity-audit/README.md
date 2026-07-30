# v0.26.41 Codex NARP 真实续会与跨 runtime 身份审计

## 迭代完成说明

- 当前仓库已经包含 Codex NARP timeout 与会话连续性的主修复：真实 command output 会沿 NCP → ACP 主链路形成活动，idle timeout 不再清空 `codex_thread_id`，runtime 重建只恢复已绑定 thread，resume 失败不会 fallback 到 `thread/start`。本轮没有复制或重写这条已正确落位的主链路。
- 本轮补齐了此前迭代唯一未闭合的真实验收：真实 idle timeout 销毁 runtime 后，下一轮由新 NARP 进程恢复同一个 Codex thread，能够回答 timeout 前保存的 marker，`codex_thread_id` 全程不变。
- 跨 runtime 审计发现两处同类身份风险：Claude SDK runtime 会接受后续消息中的不同 `session_id`，Hermes HTTP adapter 会接受后续响应头中的不同 Hermes session ID。两处都改为首次绑定后不可替换；身份漂移会明确失败，并保留原身份。
- Claude 与 Hermes 的身份约束分别留在各自 runtime/session store owner 中，没有把 provider 特判下沉到通用 stdio host，也没有新增 fallback、双写 metadata 或替代会话创建路径。
- Hermes HTTP adapter 原有根目录角色文件按 L1 module contract 迁入 `controllers/` 与 `services/`；公共 package export 和 CLI 命令名保持不变。
- 本轮没有修改真实用户 session metadata、NextClaw 配置或 Codex 会话目录，也没有增大 `requestTimeoutMs`。

## 测试/验证/验收方式

- Codex 主链路回归：`@nextclaw/nextclaw-ncp-runtime-codex-sdk` 8 个测试文件、29 个用例；NARP wrapper 3 个用例；stdio client 19 个用例；kernel 30 个定向用例；Codex NARP 15 个用例全部通过。
- 跨 runtime 回归：Claude NCP 5 个测试文件、10 个用例，Claude NARP 7 个用例，Hermes HTTP 2 个测试文件、12 个用例，Hermes ACP 7 个用例全部通过。
- 新增身份合同测试覆盖 Claude 与 Hermes 的首次绑定、相同 ID 重复报告、不同 ID 明确拒绝，以及拒绝后不持久化/不替换原身份。
- 涉及的 NCP、NARP、stdio、kernel、server、Claude、Hermes package 均完成 `tsc`、lint 与 build；仅保留仓库已有并已审计的历史 warning。
- 隔离真实源码链路使用临时 `NEXTCLAW_HOME`、`RUN_HOME` 与 `CODEX_HOME`，只复用隔离认证材料；服务、配置、session 和 Codex rollout 均位于临时目录，验收后已停止并删除。
- 活跃长命令：真实命令持续约 156 秒，并约每 20 秒输出一次；在未修改的 120 秒 idle timeout 下正常完成，随后 marker 追问成功，thread ID 不变。
- 真实 idle timeout：完全无 ACP 活动约 120 秒后得到明确 timeout；metadata 未出现身份 patch。下一轮启动新的 NARP 进程并成功回答 timeout 前 marker，thread ID 不变。
- resume 失败：隔离 session 注入不存在的 thread ID 后得到 `no rollout found for thread id ...` 明确错误；Codex rollout 数量没有增加，证明没有偷偷执行 `thread/start`，metadata 仍保留原注入 ID。

## 发布/部署方式

- 本轮只修改本地工作区；按用户要求不 commit、不 push、不创建 PR、不发布 NPM 包、不触发 runtime update 或线上部署。
- 真实验收只启动隔离源码实例，没有重启、修改或接管用户当前运行的 NextClaw 主实例。
- 不涉及数据库 migration、生产配置、Desktop installer 或 update manifest。

## 用户/产品视角的验收步骤

1. 在 Codex 会话中保存随机 marker，并记录首次绑定的 `codex_thread_id`。
2. 执行总时长超过 120 秒、但持续输出的安全命令，确认命令正常完成，随后仍能回答 marker。
3. 制造超过 idle timeout 的完全无活动 turn，确认用户收到明确 timeout，session metadata 中 thread ID 未清空、未替换。
4. timeout 后继续发送消息，确认新 runtime 恢复同一个 thread 并回答原 marker。
5. 在隔离环境提供不存在的 thread ID，确认只收到 resume 错误，没有创建替代 thread。
6. 对 Claude 与 Hermes 模拟上游返回不同 session ID，确认 runtime 明确拒绝且保留第一次绑定的身份。

## 可维护性总结汇总

- `post-edit-maintainability-guard --non-feature` 通过，无阻塞项；按 rename 识别的总代码 `+151/-52，净增 99`，排除测试后 `+52/-52，净增 0`。
- 正向减债动作为把 Hermes 根目录角色文件迁入已有 controller/service owner、删除重复的 AbortError 构造 helper，并简化 Claude runtime 的懒加载和输入构建分支。
- Claude runtime 入口从 398 行降到 390 行，没有越过 400 行预算；身份不可变校验没有引入新 service、adapter 或并行状态 owner。
- Hermes adapter service 保持既有 619 行，没有增长；它仍超过 600 行预算，作为历史红区明确保留。本轮不把身份合同修复扩成高风险的大范围路由拆分。
- 没有通过压行、转移到未计数文件或添加豁免满足净增门槛；生产语义代码零增长来自真实删除与分支收敛对必要身份校验和测试配置的完整抵消。
- `post-edit-maintainability-review`：通过，`no maintainability findings`。正向减债动作为删除、简化与职责收敛；共享 Vitest alias 配置替代两个重复配置，身份规则仍由原 runtime/session store owner 承担，没有新增平行抽象。

## 红区触达与减债记录

### packages/nextclaw-ncp-runtime-adapter-hermes-http/src/services/hermes-http-adapter.service.ts

- 本次是否减债：结构减债，文件行数不变。
- 说明：文件从 package 根目录迁入明确的 service owner，只调整相对导入和 session ID 绑定调用；没有继续增加路由、状态或兼容分支。
- 下一步拆分缝：后续独立治理可把 Hermes HTTP 路由处理与 server 生命周期拆成两个 owner；本轮不扩大范围，以免影响已经通过真实验收的 session 连续性链路。

## NPM 包发布记录

- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.2.16`：当前版本已发布；已加入 patch changeset，发布 session identity 不可替换约束。
- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk@0.2.16`：当前版本已发布；已加入 patch changeset 以携带更新后的 Claude NCP runtime 依赖。
- `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.15`：当前版本已发布；已加入 patch changeset，发布 Hermes session identity 不可替换约束与角色目录整理。
- 本批还包含前一迭代已登记、尚未发布的 Codex app-server binary patch：`@nextclaw/nextclaw-ncp-runtime-codex-sdk` 与 `@nextclaw/nextclaw-narp-runtime-codex-sdk`。
- 本批不包含顶层 `nextclaw`，因此 NPM runtime update channel、产品版本更新笔记、GitHub 产品 Release 和 X 宣发不适用。
