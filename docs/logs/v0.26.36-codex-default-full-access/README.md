# v0.26.36 Codex 默认完整权限修复

## 迭代完成说明

- 根因一是 Codex NARP wrapper 在迁移后没有继续显式设置 sandbox 与 approval policy，导致权限行为重新继承用户本机配置或 Codex 默认值；使用空 `CODEX_HOME` 实测 Codex 0.144.1 会解析为 `readOnly + on-request`。
- 根因二是 NextClaw 尚未打通 Codex app-server → NARP → NCP → UI → decision 的审批闭环，通用 stdio host 当前会取消权限请求，因此 `on-request` 不能形成可用交互。
- 根因三是 Codex app-server 的 thread 请求接受字符串 `sandbox`，turn 请求则要求结构化 `sandboxPolicy`；真实 NCP 冒烟复现了把 `"danger-full-access"` 直接传给 turn 时的协议反序列化错误。
- 修复由 Codex NARP wrapper 显式拥有 `danger-full-access + never` 产品默认，由 Codex app-server runtime 把 SDK sandbox mode 映射成 turn 所需的结构化 policy；没有新增 access-mode resolver、配置层、兼容双路径或通用 NARP Codex 特判。
- 该修复恢复了 `v0.14.190` 与 `v0.14.191` 已确立并验收过的产品合同；设计依据与后续审批边界记录在 [`2026-07-29-codex-default-full-access.design.md`](../../designs/2026-07-29-codex-default-full-access.design.md)。

## 测试/验证/验收方式

- 修前基线：使用空 Codex 配置启动真实 app-server，确认未显式传值时有效策略为 `readOnly + on-request`。
- 协议复现：首次真实 NCP → NARP → Codex 冒烟在 `turn/start` 返回 `SandboxPolicyDeserialize` 类型错误，证明 thread 字符串不能直接复用于 turn。
- `@nextclaw/nextclaw-narp-runtime-codex-sdk`：完整测试 2 个文件、15 个用例通过；`tsc`、lint、build 通过。
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk`：完整 package 测试 7 个文件、27 个用例通过；包含 app-server runtime 定向测试时共 8 个文件、29 个用例通过；`tsc`、lint、build 通过。lint 仅保留 1 条与本次无关的既有 mapper warning。
- 真实 app-server 合同验收：在环境配置故意指定 `read-only + on-request` 时，thread 显式策略仍解析为 `dangerFullAccess + never`。
- 最终功能验收：隔离 NextClaw 实例经真实 NCP → NARP → Codex 链路发出工具调用，成功在配置工作区之外写入 `/tmp/nextclaw-codex-full-access-smoke.64UXxd/outside-workspace-final.txt`，内容精确为 `final-full-access-ok`；assistant 精确回复 `WROTE`，终态为 `run.finished`，无审批请求和运行错误。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`pnpm lint:new-code:doc-file-names` 与 `pnpm changeset status` 通过。
- `pnpm check:generated-clean` 被工作区原有的 `packages/nextclaw/ui-dist` 哈希产物漂移阻塞；本轮没有触达、清理或覆盖该批并发改动。
- 隔离实例已停止；未重启或改动用户当前运行中的 NextClaw 实例。

## 发布/部署方式

- 本次只修改本地工作区；未 commit、未 push、未创建 PR、未发布 NPM 包、未触发 runtime update 或线上部署。
- 不涉及数据库 migration、远程 API 部署、Desktop installer、update manifest 或用户配置迁移。
- 发布时由 changeset 对两个受影响 package 执行 patch 升级，并评估 `nextclaw` 对 workspace 依赖的联动版本。

## 用户/产品视角的验收步骤

1. 新建 Codex 会话，不配置额外 sandbox 或审批选项。
2. 让 Codex 在当前工作区之外的明确临时路径创建文件，确认无需审批弹窗即可完成。
3. 核对工具调用成功、文件内容正确、会话正常结束。
4. 在用户本机 Codex 配置为只读时重复验收，确认 NextClaw 的显式产品默认不会被环境配置静默覆盖。

## 可维护性总结汇总

- 产品策略 owner 保留在 Codex NARP wrapper，协议形状转换保留在 Codex app-server runtime；通用 NARP host 不感知 Codex 权限语义。
- 正向减债动作是删除重复的 sandbox 字符串校验，直接复用 `ThreadOptions["sandboxMode"]` 类型合同，只保留一张 thread mode → turn policy 的必要映射表。
- 本轮可归属代码改动为新增 31 行、删除 10 行、净增 21 行；排除测试后新增 15 行、删除 10 行、净增 5 行。净增用于两项显式产品默认和 Codex 两种协议形状之间的类型安全映射，继续压缩会隐藏协议差异或削弱回归保护，因此记录 line-growth exemption。
- 当前共享工作区同一 app-server service 还包含另一批并发改动；guard 按 `HEAD` 汇总为总计新增 61 行、删除 32 行、净增 29 行，排除测试后净增 13 行，其中额外 8 行不属于本轮权限修复。
- service 当前 599 行，接近 600 行预算但本轮可归属改动净增为 0；后续若继续扩展 turn/thread 协议，应优先把请求参数构造收敛到独立协议 mapper，而不是继续增长 runtime owner。
- 标准 `post-edit-maintainability-guard` 无阻塞项；`--non-feature` 审计按共享 diff 报告行数 gate，以上述 line-growth exemption 收口。`post-edit-maintainability-review` 结论为“保留债务经说明接受”；除必要行数豁免和临近文件预算 warning 外，无新增 owner、目录、函数或抽象债务。

## NPM 包发布记录

- `@nextclaw/nextclaw-narp-runtime-codex-sdk@0.2.15`：已加入 patch changeset，显式设置 Codex 默认完整权限与无审批策略，待统一发布。
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.2.14`：已加入 patch changeset，修正 turn 的结构化 sandbox policy 映射，待统一发布。
- `nextclaw`：本次没有直接源码 changeset；统一发布时需按 workspace 依赖关系评估联动升级。
- 本轮未执行任何 NPM publish、tag、GitHub Release 或 runtime update。
