# Bibo 会话快照并发保存修复

## 问题与依据

用户于 2026-09-27 要求复现、修复并发布截图中的“结果未能保存”。2026-09-27 线上 `bibo-snapshot-failed` 日志确认：`/data/sessions/.ncp-agent-journal/.message-projections/<session>/meta.json.<pid>.<uuid>.tmp` 在递归复制期间消失，快照接口返回 500。

主链路：网页发送 → Worker / Durable Object → Harness 生成 → 容器 `/snapshot` → R2 → Durable Object 提交 → `committed` → 刷新历史。断点是快照复制后台维护的消息投影。消息投影由 canonical journal 重放生成；`NcpAgentSessionMessageProjectionStore.readAllSnapshot` 缺失时返回 null，journal owner 重放后重建。因此投影不应进入持久快照。

## 冻结方案

在现有 `sendSnapshot` 的过滤器中，精确排除 `sessions/.ncp-agent-journal/.message-projections` 目录，复制前截断整个派生树；保留 journal、正式元数据、用户工作区和 SQLite online backup。不得泛化忽略所有 `.tmp` 或所有 ENOENT，也不增加重试或并行快照实现。旧归档可照常恢复，新快照不携带派生投影，由原 owner 重建，无数据迁移。

相比逐文件排除临时文件，目录级排除同时避开投影重建目录的删除/重命名及不一致的消息/索引/meta 三件套；相比自建遍历器，复用当前复制与数据库备份路径。仅改变托管快照内容，不改变 kernel 或前端状态 owner。

## 验收合同

- contract-id：bibo-snapshot-persistence-20260927；parent-goal：用户对话能保存、刷新恢复，并在生产部署修复。
- flow：bugfix；风险 L3 持久化、L4 发布；plan：not-required，单批闭环。
- BIBO-SAVE-01（Required）：修前同一快照边界在投影临时文件持续写入/重命名期间失败；修后快照成功，journal 与工作区保留，投影不进入归档，SQLite quick_check 正常。
- BIBO-SAVE-02（Required）：新归档恢复后 journal 可重放恢复消息并重建投影，已有快照恢复兼容。
- BIBO-SAVE-03（Required）：匹配范围 TypeScript、既有 WAL 与 SSE 回归、桌面/手机发送保存刷新及失败恢复验证。
- BIBO-SAVE-04（Required）：冻结远程 master 部署 Worker 与容器，线上连续对话 committed、刷新历史、容器休眠后继续，源区 WIP 保留。
- active ledger 当前：01 not-run；02 not-run；03 not-run；04 not-run。结果在本批迭代日志更新，不重复创建合同。

## 黄金验收

用户登录 `https://app.bibo.bot/` → 发送消息 → 看到逐字回复 → 保存结束 → 刷新仍能看到完整消息 → 容器休眠后继续对话仍能读取此前上下文。AI 使用专用测试账号验证，用户无需安装或排障。故障边界仍明确报错，不能把显示出来的回复当作已保存。

## 方案 Review

mode=design：核对 journal 为 canonical 来源、缺失投影重建路径、旧快照兼容以及实际发布入口。精确排除派生树不删用户文件，不掩盖正式文件复制故障；没有新增公共抽象或第二状态 owner。design-review: passed，实施前须用并发边界复现基线，再以相同输入复验。
