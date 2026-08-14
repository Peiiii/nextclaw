# v0.36.0 工作笔记

## 冻结范围

- 产品版本：`nextclaw@0.36.0` 稳定版。
- 包含：设计、自审、runtime/kernel/server/client/UI/CLI、Skill、双语文档、changeset、NPM/runtime/GitHub/docs 发布闭环。
- 排除：Desktop installer、DMG、桌面 update manifest；外部用户资产删除；云同步/备份；Secret Broker。

## 核心决策

- 对齐 Android app-specific data、Chrome extension storage、Flatpak `--delete-data`、VS Code storage scope 和 XDG 的共同原则：代码与受管数据分离，数据按应用/实例隔离，默认避免误删，永久删除需要显式意图。
- 使用现有 instance-v1 metadata 作为文件身份，不新增第二份持久 catalog。
- AppDataManager 只从受管 inventory 和当前 owner 快照计算 active/retained；独立删除只允许 retained，并在同一锁内重检 owner。
- Workspace Service source 与 data 通过 staging 事务删除，失败时恢复路径与 grants；外部文档始终排除。
- GUI 用显式保留/删除二选一和最终按钮形成两步意图；CLI 额外要求 `--confirm <app-id>`。

## Review 返工

- 第一轮 maintainability：4 error、6 warning。
- 返工：抽出 `kernel-storage-paths.ts`、`service-app-removal.service.ts`、`service-app-delete-dialog.tsx`，CLI live API 收入 `services/local-api/`。
- 补齐：Popover 到 Dialog 的焦点交接、取消按钮默认焦点、删除错误摘要聚焦、retained 删除成功后的稳定焦点返回。
- 第二轮 maintainability：0 error、9 warning；warning 均为既有近预算/备案目录或预算内的必要清晰增长。

## 最终证据

- TSC 6/6 package 通过。
- 定向测试 91/91 通过。
- 目标 ESLint、全套 new-code governance、backlog ratchet、Skill progressive loading、107 份 docs i18n 镜像、14 项 API mapping、USAGE body sync、diff check 通过。
- 生产构建 6/6 通过；已刷新 `packages/nextclaw/ui-dist`。
- CLI 构建 help 验证通过。

## 正式发布证据

- 功能提交 `ca2c98ddc`、发布说明提交 `8d912b9d9`、稳定版提交 `26e1d3c7c` 均已推送 `origin/master`；tag 固定在稳定版提交，后续 `master` 仅增加交付记录，最终 branch closure 证明没有功能源码或发布产物只留在 release ref。
- stable dry-run 根据 changeset 列出 7 个变更包；实际 registry reconciliation 发现 15 个依赖闭包版本缺失，最终一次性发布 22/22 个包。差异是已有本地版本的 registry 补齐，不是临时扩大版本变更。
- `nextclaw@latest` 已反查为 `0.36.0`；7 个直接变更包均能按精确版本从 registry 查询。
- runtime workflow `31765994085` 四个平台和汇总任务全绿；公开 manifest、GitHub Release 四个 bundle、签名字段和 release notes URL 已复核。
- 公网从 `nextclaw@0.35.0` 安装并完成 check、download-only、apply、新进程 `0.36.0`；只下载阶段没有切换 current pointer。
- 双语发布说明已通过 Docs Deploy `31765426169` 上线并返回 200。
- X 时间线排重和两次写入结果均已核对：第一次媒体上传在发帖前失败；确认无隐藏落帖后仅重试一次，媒体成功但发帖被错误 226 拒绝，仍无帖子 ID。禁止继续盲目重试，当前保持外部阻塞。
- push 自动触发的 Desktop CI 首次失败来自 AppImage 工具下载连接重置，与源码无关；只重跑失败 job 后，Linux AppImage/deb/APT、Windows EXE/installer、macOS DMG 与 desktop runtime 全部通过，workflow `31765930306` 最终全绿，且没有触发 Desktop 发布。

## 发布恢复锚点

- Changeset：`.changeset/app-data-lifecycle-management.md` 已由稳定发布消费。
- 迭代记录：`docs/logs/v0.36.0-app-data-lifecycle/README.md`。
- 稳定版提交：`26e1d3c7c6b5bb161fb9dc1eda49787504095832`；目标主包 `nextclaw@0.36.0` 已发布。
- NPM、package tags、GitHub Release、runtime channel、真实升级和 docs 均已闭合，不得重复 publish/tag/runtime；剩余外部事项只有 X 公告，恢复时必须先回读时间线排重，再使用冻结文案与图片单次发布并按帖子 ID 回读。
