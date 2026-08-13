# App Platform 产品化工作记录

## 当前目标

按已冻结设计完成 v0.35.0 的实现、验证、Review、提交和适用正式发布。

## 当前事实

- `.napp` schema v2 已有 Package/Component 结构、版本目录、checksum 和 active pointer。
- 当前 registry 把 installation、enabled、data directory 和 v1 grants 放在同一 app record。
- package Service 共享一个 `dataDirectory`；workspace Service 没有稳定 data directory；dev Service 使用会被删除的临时目录。
- Panel iframe 为 opaque origin，不能使用 Web Storage，持久数据必须走宿主或 Service。
- native Service 继承当前用户的文件和网络权限；package 目录也仍是 owner-writable。
- schema v2 发布 payload 的 permissions 为空，Marketplace 无法准确表达 Service 风险。
- 社区发布会进入人工审核，但 artifact 审核只验证包结构和身份，不分析 Service 权限。
- 当前工作位于隔离分支 `codex/app-platform-productization`，基线为 `4731c96f5`。
- App Instance 已实现 `data/config/state/cache/tmp/logs` 目录、metadata、分类用量和旧 data 目录一次性事务迁移。
- 新安装版本记录 content digest，普通文件移除写位；激活/回滚前会重新计算完整性。
- package/workspace/dev Service 现在共享结构化 runtime env；dev instance 按源码路径稳定持久化。
- schema v2 Service 风险在客户端与 Worker 双端归一化为 `native-process/full-user`，社区 public listing 被阻断。
- App 更新可以只准备候选版本，AppPackageManager 在 engine/runtime probe 通过后才切 active pointer。
- Service action risk 改变后，旧 grant 不再自动匹配。
- Apps UI 已显示运行隔离、数据位置和总占用，Marketplace 详情明确原生进程权限。
- registry、同 App 生命周期和实例 materialize 已接入跨进程文件锁；持久化路径按受管目录重新推导，避免损坏记录越出 App Home。
- App Instance metadata 绑定 publisher id；保留数据重装允许同 publisher 恢复，拒绝不同 publisher 接管。
- 旧安装在 reconcile 时补齐 content digest 与文件只读事故防护；启用、Service 投影和 launch 都会先校验完整性。

## 关键约束 / 不变量

- App Instance 是数据、授权和运行时生命周期边界。
- Package 只承载不可变代码；可写数据不得落入版本目录。
- 不能把 env/path/chmod 宣称为 native sandbox。
- 旧用户数据是真实持久合同；迁移必须窄、可观察、失败不切换、后续删除旧兼容入口。
- product policy 归 kernel；app-runtime 只承载安装和文件事务。
- 不混入原工作区的会话/UI WIP。

## 证据 / 观察点

- 设计：`docs/designs/2026-08-14-app-platform-productization.design.md`
- 现有存储 owner：`packages/nextclaw-app-runtime/src/services/app-home.service.ts`
- 现有安装 owner：`packages/nextclaw-app-runtime/src/services/app-installation.service.ts`
- 产品 owner：`packages/nextclaw-kernel/src/managers/app-package.manager.ts`
- Service runtime env：`packages/nextclaw-kernel/src/services/mcp-service-app-runtime.service.ts`
- Marketplace publish parser：`workers/marketplace-api/src/infrastructure/apps/marketplace-app-payload.service.ts`

## 活跃假设

- 先保留 versioned JSON 并扩展 instance 字段，比本期引入 SQLite native dependency 风险更低。
- `native-process/full-user` 的诚实分级与 public listing gate 能在 OS sandbox 未完成时形成可发布的安全边界。
- workspace loose Service 使用 workspace 内 host-owned `.nextclaw/app-instances/<service-id>`，与 package instance 使用同一 `AppStorageContext` 类型；manager、真实 Service 子进程 env 和 UI DOM 定向验证均已覆盖。

## 已排除项

- 只在旧 data root 下补 cache/logs：不能解决 instance、grant、update 和 publish 问题。
- 按 component 建全局产品数据目录：组件不是用户安装边界。
- 本期一次性强制所有 Service 转 WASI：会中断现有官方 Node/MCP App。
- 用 package chmod 代表安全沙箱：同用户原生进程仍可越权。
- 本期引入本地 SQLite：仓库无依赖，会扩大桌面跨平台和打包风险。

## 关键决策

- 采用 Package / Installation / Instance / Component 四层模型。
- schema v2 兼容扩展，schema v1 停止新增而不是再造 v3。
- 结构化目录为 data/config/state/cache/tmp/logs；secrets 不落文件。
- 更新主链是候选预检与 probe 后原子切换。
- 社区 native Service 默认不能进入 public listed catalog。

## 下一步

1. 进入 Review，运行一次 diff-only maintainability guard 并收敛 findings。
2. 为用户可见变化生成 changeset，完成 v0.35.0 版本与发布批次检查。
3. 精确提交、回流本地 `master`、推送并执行适用的 NPM/Marketplace/Desktop 发布闭环。

## Validation 证据（2026-08-14）

- App runtime、kernel、server、client SDK、UI、NextClaw CLI 与 Marketplace Worker 构建通过。
- 上述七个 TypeScript package 的 `tsc --noEmit` 全部通过。
- App runtime 全量 14 个文件 / 51 项、Kernel 真实边界 2 个文件 / 20 项、Server 10 项、Client SDK 19 项、UI 7 项、NextClaw CLI 5 项、Marketplace Worker 全量 16 个文件 / 62 项通过。
- 新增真实 `.napp` 纵向验证：pack → artifact validate → registry install → Service probe/run → instance data 写入 → 故障候选更新恢复旧 runtime → 旧数据复读 → 卸载两版代码并保留数据。
- 定向 ESLint、new-code governance、governance backlog ratchet 与 `git diff --check` 通过。
- UI production build 和真实 jsdom DOM 断言通过；没有重启用户当前 NextClaw 实例，因此未把截图作为数据/协议正确性的替代证据。
- `check:generated-clean` 在未提交阶段按预期报告 `packages/nextclaw/ui-dist` 有更新；这是本次用户可见 UI 的受管发布产物，提交后需再次验证工作树生成物干净。

## 剩余缺口 / 交接提醒

- Implementation 与 L4 Validation 主链完成，尚未做 Review/Delivery。
- worktree 已使用锁文件和本机 pnpm store 建立独立 node_modules；目录被 Git 忽略。
- 原主工作区存在大量无关 WIP，所有操作继续限定在当前 worktree。
