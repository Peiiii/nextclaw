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
- 目标 ESLint、全套 new-code governance、backlog ratchet、Skill progressive loading、docs i18n/API mapping、USAGE body sync、diff check 通过。
- 生产构建 6/6 通过；已刷新 `packages/nextclaw/ui-dist`。
- CLI 构建 help 验证通过。

## 发布恢复锚点

- Changeset：`.changeset/app-data-lifecycle-management.md`。
- 迭代记录：`docs/logs/v0.36.0-app-data-lifecycle/README.md`。
- 目标主包版本：`nextclaw@0.36.0`。
- 若发布中断，先核对 NPM 7 包实际版本、Git tag/Release、runtime channel 和 docs deployment，再按 release owner 的恢复分支继续；不得重复已经成功的 publish/tag。
