# 会话启动恢复索引

## 迭代完成说明

历史会话增长到 1,381 个 journal、约 2.3 GB 后，NCP agent 每次启动都会重复读取已完成迁移的会话正文，并再次扫描全部 journal 恢复未完成 run，导致版本号旁的连接状态持续转圈约 179–224 秒。

通过真实进程分段计时、SQLite 行数核对和只读 journal 副本复现，确认 catalog 对账与 unfinished-run 恢复是两条独立全扫链路。修复后，catalog 只解析 SQLite 中未知的 journal；运行恢复使用可从 journal 重建的 SQLite 字节偏移检查点，正常启动只读取检查点之后的尾部。journal 仍是 run 生命周期事实源，写入 journal 后、推进检查点前退出的窗口会在下次启动补扫，因此修复针对根因而不是提前隐藏连接状态。

## 测试/验证/验收方式

- 6 个相关测试文件共 49 项测试通过。
- `@nextclaw/kernel` TypeScript 编译与改动文件 ESLint 通过。
- 真实数据只读副本首次建立 run 检查点约 7.9 秒，第二次恢复 90 毫秒。
- 完整隔离服务首次升级 9.919 秒进入 `ready`；后续两次分别为 981 毫秒和 1.848 秒，`/api/runtime/bootstrap-status` 与 `/api/health` 均返回 NCP agent `ready`。

## 发布/部署方式

本轮仅在隔离分支 `codex/fix-session-catalog-startup-scan` 完成实现和验证，未获授权执行 commit、push、PR、发布或部署。用户当前运行实例未被重启或修改。

## 用户/产品视角的验收步骤

1. 在已有大量历史会话的环境启动 NextClaw。
2. 首次升级允许系统建立一次恢复检查点。
3. 再次启动时，确认版本号旁的连接状态在数秒内停止转圈并进入已连接状态。
4. 模拟一个只有 `run.started`、没有 terminal 事件的 journal，重启后确认仍追加标准中断错误。

## 可维护性总结汇总

会话列表 catalog、journal 事实源和运行恢复派生检查点分别保持单一 owner。恢复索引拆到独立 store，未把复杂度藏进 UI fallback。自动维护性检查的两个文件预算错误已通过拆分关闭；最终仅保留两个正好位于 400 行预算线的提示，经主观复核无开放 finding。新增文件通过 role 与 module-structure preflight。

## NPM 包发布记录

`@nextclaw/kernel` 需要随下一批稳定版本统一发布，changeset 已准备；当前未发布。不涉及本轮直接 NPM 包发布。
