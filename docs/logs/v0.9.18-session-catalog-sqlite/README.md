# 会话目录 SQLite 迁移

## 迭代完成说明

- 根因：多个 runtime 对同一个 `.ncp-agent-session-index.json` 做整体读改写，发生 lost update；JSONL journal 仍在，但列表投影被另一进程覆盖，导致会话从列表消失。
- 确认方式：对比旧索引、journal 和直接会话读取，确认消失会话的消息事实仍在 journal；并复现两个 store 实例并发写入时旧索引的覆盖风险。
- 修复：SQLite 接管会话目录摘要，使用 WAL、事务、唯一 session ID 和删除墓碑；JSONL 继续作为消息事实源。新内核启动时先自动初始化并完成一次旧数据迁移，成功后才启动会话服务。
- 列表读取：API 使用 `page + pageSize`，SQLite 负责 `LIMIT/OFFSET`、搜索、活动排序和总数；侧栏首屏 100 条，距底部 600px 时自动预取下一页，全部会话最终可达，不采用游标。
- 兼容：迁移从 journal、metadata 和可验证 projection 重建，旧 JSON/JSONL 文件保留，不需要用户手动执行迁移命令。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel tsc` 通过。
- SQLite 迁移、损坏旧索引、旧索引缺记录、并发导入相关定向测试 25 项全部通过。
- 维护性检查 0 个错误；`git diff --check` 通过。
- 真实 home 验证：SQLite 目录包含 1284 个会话；此前消失的两个会话均可从列表、摘要和消息读取中恢复。
- 页码分页定向验证覆盖第一页/第二页不重叠、全量总数、后端搜索、`hasMore` 与侧栏滚动预取；Kernel 19 项、Server 7 项、UI 6 项测试通过，UI 与 client SDK 类型检查通过。
- 尚未在当前运行宿主上做重启后的 UI 端到端验收；提交不包含重启动作。

## 发布/部署方式

- 本次只提交代码、文档、changeset 和迭代记录，不执行 commit 之外的发布、部署或宿主重启。
- 发布后首次启动新版本时自动执行迁移；迁移失败会阻止内核以不完整会话列表运行。
- 迁移完成后保留旧文件作为回滚保险，不支持旧版本继续并发写同一个 home。

## 用户/产品视角的验收步骤

1. 停止使用同一个 home 的旧 runtime，启动包含本变更的新版本。
2. 等待内核启动完成并打开会话列表；不执行任何手动导入命令。
3. 刷新页面，确认新建会话仍排在正确的活动时间位置。
4. 检查迁移前曾消失的会话能够重新出现，并能打开完整消息历史。
5. 启动第二个 runtime 并分别创建会话，刷新两个客户端，确认会话不会互相覆盖。

## 可维护性总结汇总

- 本次将迁移扫描、摘要恢复和 SQLite 目录职责拆到明确的 store 模块，避免继续扩大单一 JSON 索引 owner。
- 保留 JSONL 事实源，删除旧索引的运行时读改写路径；没有引入长期双写或静默 fallback。
- 自动维护性检查无错误，有 3 个接近行数预算的 warning，分别位于 kernel 启动、journal store 和 SQLite summary store；本次没有新增无意义 wrapper。
- 新增文件均符合日期设计文档、store/test 和迭代目录命名规则。

## NPM 包发布记录

不涉及 NPM 包发布；本次 changeset 标记 `@nextclaw/kernel` 为 patch，待统一发布。
