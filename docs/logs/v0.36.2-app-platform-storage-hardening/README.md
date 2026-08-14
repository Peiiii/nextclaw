# v0.36.2 App 平台存储生命周期加固

## 迭代完成说明

本批次对 v0.36.0 已建立的 App 数据生命周期做产品级复核与加固，覆盖 App Package、Panel App、Service App、App Data、server、Client SDK 和 UI 的完整主链路。

- 根因是原链路仍有三类边界没有闭合：读接口会隐式创建目录或计算完整磁盘占用；进程在删除事务中断后缺少统一恢复；package 管理的 Service App 与 App Package 暴露了重复且不一致的管理入口。
- 通过端到端源码追踪、定向测试与隔离 Home 真实重启，确认问题横跨 app-runtime inventory、kernel 启动编排、server 查询合同和 UI 状态归属，而不是单个页面的显示问题。
- 修复把副作用集中到显式启动、安装、启用、调用与删除动作；list/get/catalog 保持纯读。App 与 Workspace Service 的删除先进入可识别墓碑，启动时由各自 owner 完成幂等收敛并保留可诊断失败。
- App Package 默认卸载保留个人数据，显式选择才永久删除；App Data 是 active/retained 及占用统计的唯一产品投影。package 管理的 Service App 统一跳转并聚焦到 Apps 中的所属 package，不再暴露第二个删除入口。
- UI 区分“尚无数据”“统计中”“大小不可用”，后台 package 操作结束后同时刷新 Apps、App Data 与 Panel App，不阻塞已有 Panel 刷新链路。
- `docs/USAGE.md` 与打包资源正文保持同步；`nextclaw-self-manage` Skill 已覆盖 `app data list/delete` 与开发实例 `reset-data`。本批没有新增自管理命令语义，因此无需制造重复 Skill 改动。

完整架构、数据位置、删除协议、迁移策略、产品交互和顶级产品参考见 [App 数据生命周期管理设计](../../designs/2026-08-14-app-data-lifecycle-management.design.md)。

## 测试/验证/验收方式

- 定向测试共 101 个通过：app-runtime 21、kernel 32、server 13、Client SDK 20、UI 15。
- `@nextclaw/app-runtime`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/ui` 的 TypeScript 检查通过；上述 package 与 `nextclaw` 生产构建通过。
- 变更文件 ESLint、`git diff --check` 和 diff-only maintainability guard 通过；自动检查覆盖 68 个文件，结果为 0 error，预算接近项保留为 11 个 warning。
- 隔离 Home 冷启动确认内置 App 正常注册、轻量 package API 不返回 `storageUsage`、App Data 统计和诊断正常，读取不存在的 Service App 目录不会反向创建目录。
- 人工构造 App instance 与 Workspace Service 两类中断删除墓碑后重启，墓碑均自动删除，App Data 与 Service App diagnostics 均为空。
- 本地签名更新通道真实验证完成：UI 自动发现候选，下载到 100%，应用后 PID 更换并从 `0.36.0-dev.0` 重连到 `0.36.0`；19 个内置 Skills 可用，浏览器 warning/error 为 0。

## 发布/部署方式

- 目标稳定产品版本：`nextclaw@0.36.2`，按仓库 `release:product:stable` 主链路闭合 NPM、stable runtime、GitHub Release、用户更新说明和真实旧版升级。
- Desktop installer/DMG 不属于本批授权范围；当前用户正在运行的宿主也不在隔离验证中重启。
- 发布前先完成 changeset、release health、依赖闭包、认证和 dry-run；不可逆步骤用 checkpoint 续跑，禁止重复 publish。

## 正式发布结果

- 功能提交 `27d729375` 与稳定版提交 `bb4c95fa9` 均已推送 `origin/master`；`nextclaw@0.36.2` 及同批 8 个 package tag 固定指向稳定版提交。
- 公共 NPM registry 已发布并反查 9/9 个 package，`nextclaw@latest` 为 `0.36.2`；精确冷安装确认 app/launcher 入口、更新公钥和嵌入 UI 完整。
- stable runtime workflow [`31775823815`](https://github.com/Peiiii/nextclaw/actions/runs/31775823815) 全绿，darwin arm64/x64、linux x64、win32 x64 四个平台 bundle、签名 manifest 和汇总发布任务均成功；GitHub Release 为 [NextClaw v0.36.2](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.36.2)。
- 四个平台公开 manifest 均为 `latestVersion: 0.36.2`、`minimumLauncherVersion: 0.18.11`、`hostKind: npm-runtime-bundle`，bundle/manifest signature 齐全并指向本版本英文说明。
- 公网隔离升级从 `nextclaw@0.36.1` 完成 `check -> download-only -> apply -> 新进程 0.36.2`；download-only 未提前切换 current pointer。
- Docs Deploy [`31775497769`](https://github.com/Peiiii/nextclaw/actions/runs/31775497769) 成功；[中文说明](https://docs.nextclaw.io/zh/notes/2026-08-14-nextclaw-v0-36-2)、[英文说明](https://docs.nextclaw.io/en/notes/2026-08-14-nextclaw-v0-36-2) 与[结构化 JSON](https://docs.nextclaw.io/release-notes/nextclaw-v0.36.2.json) 均返回 200，内容和 manifest URL 对齐。
- Desktop installer/DMG 未发布且不属于本批范围；release commit 自动触发的 desktop validation `31775781138` 通过，但不改变该排除边界。当前用户正在运行的宿主未被重启或升级。

## 用户/产品视角的验收步骤

1. 打开 Apps，确认 App 卡片显示受管数据路径，并能区分尚无数据与统计失败。
2. 更新 App，确认原 instance 路径和个人数据保持不变。
3. 卸载 App 时保留默认选项，确认 package 消失而数据进入 App Data；重新安装后数据可恢复。
4. 再次卸载并选择永久删除，确认 App Data 条目和受管 instance 一并消失。
5. 在 Service Apps 中查看 package 管理的 Service，确认“在应用中管理”会切换到 Apps 并聚焦所属 package，且没有独立删除动作。
6. 对 Workspace Service 分别执行保留数据和永久删除，确认源码、grants 与 instance 按选择处理；中断后重启可以自动收敛。

## 可维护性总结汇总

- 已尽最大努力保持单一路径：App Data inventory 是占用统计 owner，app-runtime inventory 是 package instance 删除 owner，Service removal service 是 Workspace source/grants/data 删除 owner，UI 只消费公共合同。
- 移除了 list/get/catalog 中的目录创建和重复占用扫描，没有新增兼容 fallback、重复 catalog 或手工路径拼接。
- 自动 guard 初次暴露 2 个文件超预算，已把 Service source 删除识别归入 removal service 并压缩 UI 重复结构；最终 0 error。11 个 warning 均为既有 owner 接近预算或已有目录例外，没有新增硬性债务。
- `service-app.manager.ts`、`service-app-list-item.tsx`、`app-package-card.tsx` 等接近预算文件没有继续拆出空心 wrapper；后续真实职责增长时再沿删除事务、存储详情和 package card section 分拆。
- 新增 changeset 与迭代路径已通过 planned-path preflight；公共导入、文件角色和 feature owner 未改变。

## NPM 包发布记录

需要发布；本批改变用户可见的卸载/数据管理行为、公共 API 查询合同与嵌入 UI 产物，必须按依赖闭包统一进入稳定批次。

| Package | 原版本 | 发布版本 | 状态 |
| --- | ---: | ---: | --- |
| `nextclaw` | 0.36.1 | 0.36.2 | 已发布，`latest` 已反查 |
| `@nextclaw/app-runtime` | 0.12.0 | 0.12.1 | 已发布 |
| `@nextclaw/kernel` | 0.8.0 | 0.8.1 | 已发布 |
| `@nextclaw/server` | 0.16.0 | 0.16.1 | 已发布 |
| `@nextclaw/client-sdk` | 0.6.0 | 0.6.1 | 已发布 |
| `@nextclaw/ui` | 0.17.0 | 0.17.1 | 已发布 |
| `@nextclaw/companion` | 0.2.30 | 0.2.31 | 已发布（内部依赖传播） |
| `@nextclaw/remote` | 0.3.30 | 0.3.31 | 已发布（内部依赖传播） |
| `@nextclaw/service` | 0.3.33 | 0.3.34 | 已发布（内部依赖传播） |

最终 checkpoint 为 `21a7a2f21fcabfac`。严格发布门禁验证 36 个 workspace package，其中 9 个进入 batch、其余仅作依赖闭包构建支持；registry reconciliation 后实际上传 9 个 package，全部成功。
