# v0.42.7 Session Interruption Projection Integrity

## 迭代完成说明

本次修复了同一 `NEXTCLAW_HOME` 下第二个 backend 实例启动后，会话历史突然只剩两条压缩提示、已确认消息无法从 projection 读取的问题。

- 根因已确认：打开第二个会话页面本身是只读的，但第二个 backend 启动时会执行 unfinished-run recovery，并向同一 append-only journal 写入 `run.error(interrupted=true)`；原有链路没有 journal 目录级的单写者授权。原 runtime 随后继续追加事件，projection tail replay 又会把晚到的 streaming/tool 事件当成短消息重新建立，覆盖已确认消息的可读指针；24 KiB compact history 视图和 checkpoint summary 元数据进一步放大了“只看到压缩行”的表现。
- 修复针对根因：journal 目录增加进程生命周期 writer lease，kernel 在任何可写初始化、事件订阅和 unfinished-run recovery 之前获取租约；活跃 owner 冲突时 fail-fast，owner 死亡后才允许 stale lease 接管，原有启动恢复仍然保留。
- replay 增加 terminal 消息保护、synthetic interruption 的历史证伪和 incremental tail 的未知 streaming ID 禁止 bootstrap；projection 升级到 v7 并支持惰性重建；API/UI view 只剥离压缩摘要大字段，不改写 journal 事实源。

## 测试/验证/验收方式

- 故障相关定向回归：journal writer/recovery、projection、compaction、server history、service startup、UI timeline 共 63 个测试通过（28 + 12 + 3 + 17，以及 app-runtime 3 个锁测试）。
- `@nextclaw/kernel` 全量：87 个测试文件、414 个测试通过。
- `@nextclaw/app-runtime`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/service`、`@nextclaw/ui` 匹配范围 `tsc` 通过；相关源码 targeted ESLint 无 error。
- 隔离临时目录双进程 harness 通过：第二 writer 被拒绝、持有进程被强制终止后 stale lease 可接管、旧版活跃 `service.json` PID 也会被拒绝；没有写入真实 `~/.nextclaw`。
- synthetic interruption、terminal 后晚到事件、legacy streaming tail、compaction marker 顺序、projection v6→v7 惰性恢复均有回归覆盖。
- diff-only maintainability 检查 `Errors: 0`，`git diff --check` 通过。
- 未执行真实事故实例热重启，也未声称完成 8.1 MiB / 17k+ 生产规模的 5 次冷、20 次 warm 性能基准；这是为避免触碰现有实例和真实 session 数据。

## 发布/部署方式

- 本次只提交源码、测试、设计记录、changeset 和迭代记录；未 push、未发布、未部署、未重启现有 NextClaw 实例。
- 不涉及数据库 migration。projection v6→v7 通过首次访问时惰性重建完成。
- 新 runtime 与同一 `NEXTCLAW_HOME` 的已有活跃 owner 冲突时，应继续使用已有实例；需要并行开发实例时使用隔离的 `NEXTCLAW_HOME`。

## 用户/产品视角的验收步骤

1. 在一个数据目录启动 NextClaw，并打开已有会话确认历史完整。
2. 再用同一个 `NEXTCLAW_HOME` 启动第二个 backend；第二实例应在进入 recovery/写入前明确提示 writer 冲突，不应追加 journal 或发布 backend ready。
3. 关闭原实例后重新启动，确认 stale lease 可接管，unfinished-run recovery 仍执行一次，历史消息完整可读。
4. 对含有旧 projection 或压缩 marker 的会话刷新并翻页，确认近期 user/assistant 消息无重复、无遗漏，压缩摘要仍可供模型上下文使用但不会撑大 history payload。
5. 需要双实例并行开发时分别设置不同的 `NEXTCLAW_HOME`，两边均可独立启动和写入。

## 可维护性总结汇总

- 本次遵循单一 owner 和单一路径原则：writer 生命周期、replay 编排、事件转换和恢复回归用例分别归入真实职责文件，未在 server controller、UI 或 ingestion service 中复制 journal 写权限。
- 保留原有启动检查、unfinished-run scan、compaction、cursor pagination、projection 随机读取和 append 热路径；没有引入每次 append 加锁、heartbeat、daemon 或第二套只读 backend。
- writer lease 复用 app-runtime 的 FileLockService；projection/API 的修复保持 journal 为唯一事实源，派生 projection 可删除、可重建。
- 新增文件已运行 planned-path preflight。maintainability guard 最终无阻断 finding，仅报告既有/接近预算提示：`nextclaw-kernel.ts`、journal 测试、journal store、projection persistence store；本次没有为消除普通 warning 扩大无关重构。
- 设计与实施证据集中记录在 [session interruption projection integrity design](../../designs/2026-08-22-session-interruption-projection-integrity.design.md)。

## NPM 包发布记录

- 本次未执行 NPM 包发布。
- changeset 涉及：`@nextclaw/app-runtime`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/service`、`@nextclaw/ui`，均为 `patch`，待后续统一发布批次消费。
- 当前工作区仍有其他任务的 changeset 和源码改动；后续发布必须重新按精确范围核对，不能把本记录视为发布授权。
