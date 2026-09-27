# Bibo 会话保存故障修复与部署

## 迭代完成说明

进行中。用户要求“bibo 这里经常遇到这样的问题。复现修复发布”，截图标示“结果未能保存，请重试。输入已保留，可重新发送。”附件中的其它对话内容只作现场线索。

根因：快照递归复制了由会话日志生成的消息投影；后台对 meta 临时文件做原子重命名，复制期间 `lstat` 触发 ENOENT。线上日志于 2026-09-27T04:58:27Z 命中该路径。本地在持续 SQLite WAL 写入及 meta 写入/重命名期间复现 `/snapshot` 500 与同一 ENOENT。修复精确排除 canonical journal 下的派生投影目录，保留日志及 SQLite online backup；不吞正式文件错误，不泛化排除用户文件。设计见 [修复方案](../../designs/2026-09-27-bibo-snapshot-persistence.design.md)。

## 测试/验证/验收方式

Active acceptance ledger（contract-id: bibo-snapshot-persistence-20260927）：

| ID | Required | Status | 当前证据 |
| --- | --- | --- | --- |
| BIBO-SAVE-01 | true | passed | 修前同边界 500 ENOENT；修后 snapshot 测试成功、journal/用户文件保留、无派生投影、SQLite quick_check ok |
| BIBO-SAVE-02 | true | passed | cold replay 覆盖六轮工具消息、投影缺失重建与再次冷重载，8 项恢复测试通过；旧归档格式及 restore 路径未变 |
| BIBO-SAVE-03 | true | passed | Bibo 三份 tsc；WAL/SSE 三项测试；Vite + 桌面/手机发送、保存、滚动、刷新、失败保留输入 smoke；targeted lint |
| BIBO-SAVE-04 | true | not-run | 等待主线集成、冻结部署、生产连续对话与休眠恢复验证 |

## 发布/部署方式

仅发布 Bibo 托管 Worker/Container，用户授权覆盖本服务提交、主线集成、推送及部署。从冻结远程 master 的干净 worktree 执行 `pnpm -C apps/bibo-hosted run deploy`；使用项目指定 Wrangler 4.138.0。线上旧 Worker 版本 `8ed59b77-81c4-4048-8728-55d5120202c6`，旧容器 application version 16、镜像 digest `b4d776c1bfc62db0fa06afe2ea39f81b77893046564a9d442dc8b11baec5bf27`，保留回退入口。无数据迁移，旧快照兼容；不涉及 NextClaw NPM/runtime/desktop。

## 用户/产品视角的验收步骤

登录 https://app.bibo.bot/ → 发送消息 → 等待保存结束 → 刷新仍见本轮对话 → 容器休眠后继续上一段对话。AI 以专用账号完成该链路，未将截图中的用户账号用于测试。

## 可维护性总结汇总

快照 owner 继续归 Bibo runner；复用原复制、压缩、SQLite backup、R2/DO 提交与 journal 恢复主链路，没有新状态、重试或公共抽象。根因对应的并发边界进入既有测试；运行说明更新原 README，作为本次复盘沉淀。planned-path preflight、governance 和 ratchet 通过。冷恢复测试最初放入 journal 大文件触发文件预算，已移入职责匹配的 tool-tail recovery 现有测试，最终 maintainability diff 检查 0 errors / 0 warnings，targeted lint 通过。implementation Review: no findings。普通修复不进入博客发布。

## NPM 包发布记录

不涉及 NPM 包发布。`@nextclaw/bibo-hosted` 是私有托管 app，用户可见 bugfix 记入 changeset，实际交付为 Worker 与 Container 部署。
