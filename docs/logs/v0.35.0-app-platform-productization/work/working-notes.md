# App Platform 产品化工作记录

## 当前目标

按已冻结设计完成 v0.35.0 的实现、验证、Review、提交和适用正式发布；核心产品发布已完成，X 公告受外部日限额阻塞。

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

1. X 写入限额恢复后，复用冻结文案和截图只发布一次，再按 post ID 回读作者、正文和媒体。
2. 后续独立处理 GitHub Actions Node 20 action runtime 弃用提示，不与本次产品改动混合。

## Validation 证据（2026-08-14）

- App runtime、kernel、server、client SDK、UI、NextClaw CLI 与 Marketplace Worker 构建通过。
- 上述七个 TypeScript package 的 `tsc --noEmit` 全部通过。
- App runtime 全量 14 个文件 / 51 项、Kernel 真实边界 2 个文件 / 20 项、Server 10 项、Client SDK 19 项、UI 7 项、NextClaw CLI 5 项、Marketplace Worker 全量 16 个文件 / 62 项通过。
- 新增真实 `.napp` 纵向验证：pack → artifact validate → registry install → Service probe/run → instance data 写入 → 故障候选更新恢复旧 runtime → 旧数据复读 → 卸载两版代码并保留数据。
- 定向 ESLint、new-code governance、governance backlog ratchet 与 `git diff --check` 通过。
- UI production build 和真实 jsdom DOM 断言通过；没有重启用户当前 NextClaw 实例，因此未把截图作为数据/协议正确性的替代证据。
- `check:generated-clean` 在发布提交后通过，受管 `packages/nextclaw/ui-dist` 与源码构建结果一致。

## Review 与 Delivery 证据（2026-08-14）

- 首轮 diff-only maintainability guard 捕获 4 个文件预算错误；按职责拆分 installation lifecycle/filesystem、package presentation 与 Service record 后，终轮为 0 error、9 个近预算 warning，主观复核 no findings。
- 三个提交已进入并推送 `master`：功能 `298233cac`、说明 `05b72ac1f`、stable batch `eab1f2614`；九个 NPM tag 已推送。
- 公开 NPM registry 发布 9/9 成功；`nextclaw@0.35.0` 冷安装验证 version、App entry、launcher entry、public key 和 embedded UI。
- stable runtime workflow `31737711368` 与四平台 bundle/channel publish 全部成功，GitHub Release 和公网 manifest 指向 `0.35.0`；从 `0.34.0` 的真实 check/download/apply/new-process 升级通过。
- Marketplace Worker Version ID `54de726b-a835-4083-a8ed-195de68fad31`；双域名 health、plugins、skills、Apps v1/v2 冒烟通过。
- Docs Deploy `31737092325` 成功，公开部署验证匹配说明提交 `05b72ac1f`。
- X 冻结公告尝试一次后收到错误 344；当前 query ID 已刷新，账号时间线确认无隐藏帖，按发布安全合同停止重试。

## 剩余缺口 / 交接提醒

- 核心产品 Delivery 已完成；仅 X 公告仍待外部限额恢复，不能报告 `NEXTCLAW_STABLE_READY` 全表面完成。
- 任意 migration runner/checkpoint、SQLite、多实例 UI、secret broker、OS sandbox 与 WASI network broker 仍是设计中明确延期项，不把 native chmod 误称为 sandbox。
- 原主工作区存在大量无关 WIP，本次全过程限定在隔离 worktree，未覆盖或混入原工作区改动。
