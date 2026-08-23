# 会话目录迁移至 SQLite 设计

## 状态

- 日期：2026-08-23
- 阶段：已实现，待随 changeset 发布
- 范围：会话列表、会话摘要、旧会话迁移与崩溃恢复

## 背景与结论

当前会话的消息事实保存在每个会话的 JSONL journal 中；会话列表依赖单个 `.ncp-agent-session-index.json` 投影文件。这个投影文件由多个运行进程整体读改写，存在“最后一次完整写入覆盖前一次写入”的竞态，因此会出现 journal 仍在、列表摘要却消失的情况。

正式方案采用分层存储：

1. JSONL journal 继续作为会话事件事实源，避免在本次迁移中搬动消息数据。
2. SQLite 永久接管会话目录和摘要投影，负责列表查询、并发写入、迁移状态和删除墓碑。
3. 旧 JSON 索引不再作为运行时主数据源；迁移失败时也不静默回退到它。

这不是把旧索引文件机械转换成数据库，而是从 journal、metadata 和现有消息投影重建。这样能恢复“旧索引没有、但 journal 仍然存在”的会话。

## 数据权威性

### 事实源

- `<session-id>.jsonl`：会话事件和消息事实。
- `<session-id>.metadata.json`：旧格式的会话元数据；迁移阶段优先读取它。

### 可重建投影

- SQLite 会话目录：列表需要的 `session_id`、时间、消息数、peer、agent、状态和 metadata 快照。
- 现有消息 projection：继续服务消息读取和快速计数，但可由 journal 重建。
- `.ncp-agent-session-index.json`：只作为迁移诊断参考，不再参与正常列表读写。

如果同一字段冲突，优先级为：journal/metadata 推导值 > 可验证的消息 projection > 旧 JSON 索引提示值。旧索引只能补充无法从现有源推导的兼容信息，不能覆盖事实源。

## SQLite 结构

数据库建议放在现有 session 数据目录内，例如：

`<NEXTCLAW_HOME>/sessions/.ncp-agent-session-catalog.sqlite`

核心表：

```sql
CREATE TABLE sessions (
  session_id      TEXT PRIMARY KEY,
  peer_id         TEXT,
  agent_id        TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  last_message_at TEXT,
  message_count   INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL,
  metadata_json   TEXT NOT NULL DEFAULT '{}',
  deleted_at      TEXT,
  source_revision INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE storage_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE migration_diagnostics (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT,
  kind         TEXT NOT NULL,
  detail_json  TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
```

启用 WAL、foreign keys、合理的 busy timeout，并通过事务完成每次摘要更新。`deleted_at` 是删除墓碑：它防止崩溃恢复或重扫 journal 时把用户主动删除的会话重新导入。

## 旧数据迁移流程

迁移必须在所有使用同一个 `NEXTCLAW_HOME` 的旧进程停止后执行一次；当前机器上已经发现多个进程共享同一个 home，这一步是必要的。

启动新版本时：

1. 打开或创建 SQLite 文件，取得迁移互斥事务。
2. 若 schema 已完成，直接进入正常运行；若未完成，进入一次性迁移。
3. 扫描全部旧 `<session-id>.jsonl`，不能只遍历旧 JSON 索引。
4. 对每个 journal：解析 metadata、重放事件、重建消息边界和摘要；读取同名 metadata sidecar 作为旧格式补充。
5. 对缺失或损坏的消息 projection，允许从 journal 重建；projection 不完整不能导致会话被漏掉。
6. 将推导出的会话以批量事务写入 `sessions`。
7. 对“旧索引有记录、但没有 journal 或可验证 metadata/projection”的条目，不放入用户列表，写入 `migration_diagnostics`，避免把已经删除的幽灵会话复活。
8. 写入 schema/migration 完成标记，事务提交后才允许正常服务。

迁移过程中不覆盖、不删除旧 JSONL、metadata、projection 或旧 JSON 索引。SQLite 写入失败时保留旧数据，删除或隔离未完成的数据库后可重试；不会悄悄切回不安全的 JSON 写入路径。

本次已发现的 `ncp-mt5pi8ng-74uf4xy4` 属于“journal 存在、旧索引缺失”的情况，按此流程会被重新写入 SQLite 列表。

## 正常写入链路

每个事件遵循：

1. 先追加到该会话 JSONL journal。
2. 按事件重算或更新会话摘要。
3. 在同一个 SQLite 事务中 upsert `sessions`。

如果进程在第 1 步和第 3 步之间崩溃，下一次启动的 reconciliation 会发现 journal 比 SQLite 新并补齐摘要；不会凭空生成没有 journal 事实的会话。

列表只读 SQLite，不再把整个索引加载到内存后整体覆写。多个 NextClaw 进程通过 SQLite 的事务、锁和 WAL 协作，不互相覆盖完整快照。

## 删除与恢复

删除先在 SQLite 事务中写入 `deleted_at`，再删除 journal、metadata 和 projection，最后清理或保留墓碑。中途崩溃时：

- 列表不会重新显示已删除会话；
- 下次启动可继续清理残留文件；
- 没有显式删除墓碑的旧孤儿文件只会进入 reconciliation，不自动当作用户新会话复活。

## 版本与回滚合同

- SQLite schema 使用 `PRAGMA user_version` 和 `storage_meta` 双重记录版本。
- 首次迁移保留旧文件作为回滚保险，至少跨过一个验证发布周期再考虑清理。
- 新版本完成迁移后，不支持旧版本继续并发写同一个 home；旧版本若无法识别 SQLite 状态，必须在启动前被运维约束停止，否则降级运行可能产生分叉数据。
- 不做长期双写。双写会重新引入两个事实源和不一致窗口；兼容窗口只存在于一次性迁移期间。

## 验收条件

至少覆盖：

- 旧索引完整、缺记录、损坏、为空四种情况；
- journal 存在但索引没有的会话能进入列表；
- projection 缺失或过期时仍能恢复摘要；
- 并发两个进程创建/更新不同会话不会互相覆盖；
- journal 已写、SQLite 未写的崩溃窗口可在重启后补齐；
- 删除中途崩溃不会复活会话；
- 迁移失败不破坏任何旧文件，且可重试；
- 迁移完成后列表、详情和消息读取继续使用同一会话 ID。

实现前还需要冻结 SQLite Node 驱动及桌面打包方式，必须同时满足当前支持的 Node 版本和桌面发行包，不直接假设运行环境一定提供 `node:sqlite`。
