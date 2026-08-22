# v0.42.7 Session Interruption Projection Integrity

## 迭代完成说明

本次修复了同一 `NEXTCLAW_HOME` 下第二个 backend 实例启动后，会话历史突然只剩两条压缩提示、已确认消息无法从 projection 读取的问题，并纠正了此前过度限制可用性的修复方案。

- 根因已确认：打开第二个会话页面本身是只读的，但第二个 backend 启动时会执行 unfinished-run recovery，并向同一 append-only journal 写入 `run.error(interrupted=true)`；原有链路没有 journal 目录级的单写者授权。原 runtime 随后继续追加事件，projection tail replay 又会把晚到的 streaming/tool 事件当成短消息重新建立，覆盖已确认消息的可读指针；24 KiB compact history 视图和 checkpoint summary 元数据进一步放大了“只看到压缩行”的表现。
- 原方案曾针对根因增加 journal 目录进程生命周期 writer lease，但真实开发链路证明它把 runtime 级共享资源误判成会话级独占资源：即使用户要发的是新会话，也会被已有 runtime 的 owner 冲突拦截。最终修正删除 writer lease、legacy-owner guard 和 kernel 启动 fail-fast；同一 `NEXTCLAW_HOME` 下的第二 runtime、新会话和同一会话都不能再被全局阻断。
- replay 增加 terminal 消息保护、synthetic interruption 的历史证伪和 incremental tail 的未知 streaming ID 禁止 bootstrap；projection 升级到 v7 并支持惰性重建；API/UI view 只剥离压缩摘要大字段，不改写 journal 事实源。
- 可用性边界：不再用 runtime、run 或 session 级硬锁保护 journal；共享写入异常必须局部处理、重建或降级，不能升级成整个聊天 runtime 不可用。

## 测试/验证/验收方式

- journal recovery 与 service startup 定向回归共 6 个测试通过；两个 package 的匹配 `tsc` 通过，相关源码 targeted ESLint 无 error。
- 隔离临时目录两个 journal store 可同时打开同一目录；没有写入真实 `~/.nextclaw`。
- 本地 5174 页面沿真实入口重新加载后显示“已连接”，18792 bootstrap-status 返回 `phase:ready / ncpAgent:ready`；未代替用户发送真实测试消息。
- diff-only maintainability 检查 `Errors: 0`，`git diff --check` 通过；仅保留两个接近 400 行预算的既有文件 warning。
- synthetic interruption、terminal 后晚到事件、legacy streaming tail、compaction marker 顺序、projection v6→v7 惰性恢复均有回归覆盖。
- diff-only maintainability 检查 `Errors: 0`，`git diff --check` 通过。
- 未执行真实事故实例热重启，也未声称完成 8.1 MiB / 17k+ 生产规模的 5 次冷、20 次 warm 性能基准；这是为避免触碰现有实例和真实 session 数据。

## 发布/部署方式

- 本次只提交源码、测试、设计记录、changeset 和本迭代记录；不 push、不发布、不部署、不重启现有 NextClaw 实例。
- 不涉及数据库 migration。projection v6→v7 通过首次访问时惰性重建完成。
- 同一 `NEXTCLAW_HOME` 下的多个 runtime 不再因 journal ownership 被强制冲突退出；并发写入风险仍需通过后续局部恢复机制治理，不能重新引入全局启动限制。

## 用户/产品视角的验收步骤

1. 在一个数据目录启动 NextClaw，并打开已有会话确认历史完整。
2. 再用同一个 `NEXTCLAW_HOME` 启动第二个 backend；第二实例应完成初始化并可进入新会话，不应因 writer 冲突被阻断。
3. 在两个 runtime 中分别验证新会话与已有会话，确认发送入口不被目录级 ownership 一刀切禁用；真正的局部 journal/projection 异常不能扩散成全局不可用。
4. 对含有旧 projection 或压缩 marker 的会话刷新并翻页，确认近期 user/assistant 消息无重复、无遗漏，压缩摘要仍可供模型上下文使用但不会撑大 history payload。
5. 需要双实例并行开发时分别设置不同的 `NEXTCLAW_HOME`，两边均可独立启动和写入。

## 可维护性总结汇总

- 本次遵循单一 owner 和单一路径原则：删除无收益的 writer 生命周期服务与 kernel 启动 gate，保留 replay 编排、事件转换和恢复回归用例；未在 server controller、UI 或 ingestion service 中复制 journal 写权限。
- 没有用 session 锁替代 runtime 锁；保留 unfinished-run scan、compaction、cursor pagination、projection 随机读取和 replay 修复，避免保护逻辑再次牺牲新会话可用性。
- maintainability guard 最终无阻断 finding，仅报告两个接近预算提示；本次通过删除服务、字段、启动/退出钩子减少代码，没有为消除普通 warning 扩大无关重构。
- 设计与实施证据集中记录在 [session interruption projection integrity design](../../designs/2026-08-22-session-interruption-projection-integrity.design.md)。

## NPM 包发布记录

- 本次未执行 NPM 包发布。
- changeset 保留原受影响 package 的 patch 发布声明：`@nextclaw/app-runtime`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/service`、`@nextclaw/ui`，待后续统一发布批次消费。
- 当前工作区仍有其他任务的 changeset 和源码改动；后续发布必须重新按精确范围核对，不能把本记录视为发布授权。
