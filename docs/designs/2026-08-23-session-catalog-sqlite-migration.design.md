# 会话目录迁移至 SQLite 设计

## 状态

- 日期：2026-08-23
- 阶段：主体已实现，Desktop native 打包与发布门缺口修复中
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

## Desktop native 依赖与发布闭环

### 触发证据与范围

2026-08-24 的 Desktop stable 发布前验证证明，SQLite 迁移本身已实现，但 native 驱动的发行合同没有被原设计完整建模：

- Linux AppImage 内的 `better_sqlite3.node` 使用 Node ABI 127 构建，而 Electron 32 的嵌入式 runtime 要求 ABI 128，NCP agent 因此启动失败。
- `/api/health` 把 `ncpAgent` 硬编码为 `ready`，Desktop 启动器和 Linux smoke 只检查 HTTP 成功，导致进程尚未完成内核启动时提前放行。
- Desktop shell 安装包与可独立更新的 product bundle 都会运行同一份 SQLite 目录代码；只修安装包会使从旧 Desktop 增量升级到新 runtime 的用户继续缺少正确的 native 模块。

这属于同一能力面横跨安装、增量更新、首次迁移、重启恢复和三平台验证的合同缺口。范围只覆盖 `better-sqlite3` 的 Desktop 构建与装载，以及能证明它真实可用的 readiness；不扩展为任意插件 native 模块框架，也不改变 NPM runtime 的 Node 执行模型。

### 执行环境矩阵

| 产物 | 实际执行器 | `better-sqlite3` 合同 | 构建 owner |
| --- | --- | --- | --- |
| NPM package / runtime channel | 用户安装的受支持 Node.js | 保留 Node ABI，由 `pnpm --prod deploy` 形成完整依赖闭包 | NPM runtime channel builder |
| Desktop shell 安装包 | 打包的 Electron，以 `ELECTRON_RUN_AS_NODE=1` 启动 runtime | 必须按目标 Electron 版本、平台和架构重建 | Desktop native resource staging |
| Desktop seed / product update bundle | 已安装 Desktop 的 Electron | 必须包含与 shell 相同目标的 native 模块和运行时依赖闭包 | 同一个 Desktop native resource staging |

Node ABI 产物与 Electron ABI 产物不得共享可变的 workspace `node_modules`。Desktop 构建必须把依赖复制到隔离目录后重建，避免破坏同时生成的 NPM runtime，也避免多平台 CI 并发竞争。

### 唯一 owner 与产物合同

`apps/desktop/scripts/prepare-native-app-resources.mjs` 升级为 Desktop native runtime 依赖的唯一 staging owner，并同时服务 shell 和 product bundle builder：

1. 根据显式 `platform`、`arch` 和 Desktop `electron` 版本解析目标，禁止从构建机的 Node ABI 推断。
2. 复制 `better-sqlite3` 的运行时闭包：`better-sqlite3`、`bindings`、`file-uri-to-path`。
3. 在隔离 staging 目录中通过项目直接声明的 native 准备工具，强制获取与 Electron ABI、平台和架构完全匹配的 `better-sqlite3` 官方 prebuild；目标产物不存在时立即失败，不跨架构源码编译。
4. 继续复制现有 `sharp` 及目标平台包；product bundle builder 不再维护平行的 sharp-only 复制清单。
5. 输出稳定的 `node_modules` 目录，供 shell 的 `app.asar.unpacked` 和 product bundle 的 `bundle/node_modules` 消费。

构建失败、目标平台不支持、native binary 缺失或闭包不完整时必须立即失败；禁止退回 workspace 中碰巧存在的 binary，禁止发布后再尝试在线编译。

### 存活、就绪与发布门

`/api/health` 只证明 HTTP server 存活，不能再作为 Desktop runtime 就绪的唯一证据。真实 readiness 使用现有 `/api/runtime/bootstrap-status`：

- `ncpAgent.state === "ready"` 是 SQLite 驱动已成功装载且 agent 初始化完成的必要条件。
- `ncpAgent.state === "error"` 或 `phase === "error"` 立即失败，并保留错误信息。
- 在首次达到 ready 后，进程还需跨过短稳定窗口并再次读取状态，排除“端口先启动、异步初始化随后退出”。
- Desktop 启动器、Linux AppImage smoke、Windows unpacked/installer smoke 与 macOS DMG smoke 复用同一判定语义；静态包检查不能替代真实启动。

`/api/health` 返回的 service 状态若继续保留，必须从 bootstrap status 推导，不能硬编码成 `ready`。健康接口的兼容职责是保持 HTTP 200 供存活探针使用；发布 readiness 单独采用严格状态。

### 安装、更新与迁移状态矩阵

| 场景 | 预期行为 |
| --- | --- |
| 全新安装 | shell 与 seed bundle 都携带 Electron ABI native 闭包；首次启动创建空 catalog 并达到 ready |
| 旧 Desktop + 新 product bundle | 更新包自身携带 native 闭包；不依赖旧 shell 里不存在的模块即可启动 |
| 旧 JSON 索引升级 | 在隔离 home 中扫描 journal/metadata，创建 SQLite，列表数量与稳定 ID 可核对，旧文件不被删除 |
| 已迁移 home 重启 | 复用现有 SQLite，重复启动幂等，列表与详情保持一致 |
| native binary 缺失或 ABI 错误 | bootstrap 进入 error 或进程失败；所有 Desktop 发布 smoke 必须失败并输出 native load 错误 |
| 迁移写入失败 | 旧文件保持不变、发布 smoke 失败；不回退到旧 JSON 写入主链路 |

迁移验证必须使用隔离的 `NEXTCLAW_HOME` 或旧 home 的只读复制，不允许为了发布验证直接操作用户当前运行实例的数据目录。

### 发布验收与退出条件

在进入 stable 发布前必须同时满足：

- 定向测试证明 native staging 对各目标解析正确、依赖闭包完整，product bundle 与 shell 使用同一 owner。
- TypeScript 受影响 package 的 `tsc` 通过；脚本与 package 静态合同检查通过。
- 当前平台真实打包后，由打包 Electron 成功加载 `better-sqlite3`、创建临时数据库并运行最小查询。
- Linux AppImage、Windows installer/unpacked、macOS DMG 均达到严格 bootstrap readiness，且 native 失败夹具会让门失败。
- 旧索引迁移、索引缺记录恢复、已迁移重启至少各完成一次隔离验证。
- Desktop seed/product bundle 的版本、签名、native 闭包和 update manifest 回读一致。
- NPM stable/runtime channel 与 Desktop stable 的版本闭环完成后，才更新 stable 指针；任何平台失败都不得把部分结果描述为完整正式发布。

此前“实现前待冻结”的问题由本节关闭：SQLite 驱动继续使用 `better-sqlite3`，NPM 使用 Node ABI，Desktop shell 与 product bundle 统一使用目标 Electron ABI，并以真实 bootstrap readiness 作为发布门。

`better-sqlite3` 的退出条件是：NextClaw 支持的最低 Node.js 与 Desktop 内嵌 Electron 必须同时提供非实验、合同足够稳定的 `node:sqlite`，并完成迁移兼容和性能验证。当前 Electron 32 内嵌 Node 20.18.1，不存在 `node:sqlite`，因此本次发布不能删除该依赖。
