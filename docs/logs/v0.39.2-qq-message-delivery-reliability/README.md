# QQ 消息交付可靠性

## 迭代完成说明

- 根因：`qq-official-bot` 在心跳超时等未枚举 WebSocket close code 下，即使仍保留有效 `session_id` 和 `seq` 也强制新建 session，断线窗口内的 QQ 事件因此不会补投。QQ 扩展另有两个独立边界：`publishInbound` 前过早提交去重状态，bot 不可用时出站返回伪成功。
- 确认方式：只保留一个本地 NextClaw/QQ 实例，冻结 QQ 子进程 75 秒并在网关空窗发送唯一标记。未修补时标记可见于 QQ 客户端、但不进入 NCP journal，恢复事件为新 `READY`。
- 根因修复：升级 SDK 到 1.2.4 以删除重复重连路径，用 pnpm 依赖补丁在 session 状态仍有效时按最后 `seq` RESUME，并透出 `RESUMED` 诊断。QQ 入站去重改为 `processing -> processed` 两阶段提交，出站在断开时明确失败。

## 测试/验证/验收方式

- `pnpm install --frozen-lockfile --offline`
- `pnpm --filter @nextclaw/channel-extension-qq test`：12 个测试通过。
- `pnpm --filter @nextclaw/channel-extension-qq tsc`
- `pnpm --filter @nextclaw/channel-extension-qq lint`
- `pnpm --filter @nextclaw/channel-extension-qq build`
- 真实 QQ 基线 1 发/1 入站/1 回复，突发 5 发/5 入站/5 回复。
- 同一个 75 秒断线窗口复现在修复后连续两次补投成功；最终标记 `QFR5RFQ` 观察到 `RESUMED`、入站一次、回复一次，恢复后 `QFR6RFQ` 仍正常收发。

## 发布/部署方式

本次只完成本地代码提交，不执行 push、NPM 发布、runtime 更新或部署。发布时由常规 changeset 流程升级 `@nextclaw/channel-extension-qq`。

## 用户/产品视角的验收步骤

1. 在唯一 NextClaw 实例中启用 QQ 渠道，连续发送多条编号消息，确认每条均只收到一次回复。
2. 在可控测试环境中制造 QQ WebSocket 心跳超时，断线窗口内发送唯一标记。
3. 确认连接记录 `RESUMED`，窗口消息只进入 journal 一次并返回 QQ 回复。
4. 恢复后再发送一条消息，确认持续收发正常。

## 可维护性总结汇总

- 去重状态收敛为一个明确的两阶段 owner，不新增平行队列、transport 或历史轮询路径。
- 依赖补丁仅修改两个 SDK 恢复点，无效 session 的回落语义保持不变。
- 诊断不记录消息正文、用户身份或凭据。
- diff-only 可维护性自动检查通过，没有触发主观复核 reference；目录和新增文件已通过 planned-path preflight。

## NPM 包发布记录

- 需要发布：`@nextclaw/channel-extension-qq`，当前仓库版本 `0.2.24`。
- 本次状态：已添加 patch changeset，待统一发布。
- 本次未执行 NPM 发布。
