# Node 与 SQLite 运行合同设计

## 结论

NextClaw 的 NPM 版本改用统一 SQLite 驱动，彻底删除 `better-sqlite3` 以及它在 NPM、node-gyp、Electron rebuild 和桌面资源打包中的原生模块链。用户无需 Python、C++ 编译器或系统 SQLite。

公开支持合同为 Node `^20.19.0 || >=22.12.0`；仓库开发与 CI 使用 `.nvmrc` 固定 `22.23.2`。Node 22.5+ 优先使用 `node:sqlite`，Node 20 使用随 NPM 包安装的 `sql.js` WASM 驱动；两条路径读写同一种 SQLite 数据库文件，不要求 Python、编译器或系统 SQLite。

## 唯一 owner

- `NcpAgentSessionSummaryIndexStore` 继续拥有现有 SQLite 文件、schema 与事务语义，只替换驱动，不改变数据格式或业务 API。Node 20 的便携驱动以原子文件替换持久化，较新 Node 使用原生 WAL。
- NPM launcher 在任何 workspace/service import 之前验证 Node 版本；`package.json#engines` 是安装器提示，launcher guard 是确定执行合同。
- `.nvmrc` 是开发/CI Node 版本事实源；worktree 创建和仓库命令统一从它启动，不在 workflow 中散落版本号。
- Desktop 使用包含 Node 24 的受支持 Electron 稳定线，并直接消费同一 SQLite owner；删除 native module loader/rebuild/copy 旁路。

## 兼容与迁移

- 数据库仍是标准 SQLite 文件；升级测试必须跨原生与 WASM 驱动打开、读取、写入和执行事务，证明无需数据迁移。
- Node 20.19、22.19、24、26 在 Linux x64、Windows x64、macOS arm64/x64 的正式 NPM 产物执行安装与 SQLite CRUD；Node 18 验证快速失败文案。
- 打包版自带 Electron/Node，不依赖用户系统 Node；只有 NPM 安装路径受公开 engines 合同约束。

## 删除与延后

- 删除 `better-sqlite3`、类型包、Electron rebuild/复制/查找逻辑以及 `--ignore-scripts` 掩盖原生安装问题的发布烟测。
- 不引入 ORM 或平台 optional native 包；只有 Node 20 在同一 store owner 内使用便携 WASM 驱动。

## 验收

1. 仓库与发布 tarball 不再包含 `better-sqlite3` 运行依赖或桌面原生复制链。
2. 旧数据库 fixture 在新实现下保持 schema、数据和事务行为。
3. 受支持 Node 矩阵真实安装正式 tarball并完成 SQLite CRUD；Node 18 在业务模块加载前输出可操作错误。
4. Desktop 主进程在升级后的 Electron 上启动并读写相同数据库。
5. 新 worktree 创建后无需人工切 Node，脚本会使用 `.nvmrc` 并验证 pnpm。
