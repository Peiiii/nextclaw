# v0.36.0 App 数据生命周期产品化

## 迭代完成说明

本批次把 App、Panel App 和 Service App 的数据从“已有目录但缺少完整管理语义”提升为可安装、可更新、可卸载、可保留、可再次发现并永久删除的统一产品能力。

- 正式 App 数据统一落在 `$NEXTCLAW_APP_HOME/instances/<app-id>/default/`，Workspace Service 数据落在 `<workspace>/.nextclaw/app-instances/<app-id>/default/`，并按 `data/config/state/cache/tmp/logs` 六类隔离。
- 更新保留稳定 instance；卸载与 Workspace Service 删除默认保留个人数据，只有显式选择才 purge。
- kernel 通过 AppDataManager 统一投影 active/retained，server、Client SDK、UI 和 CLI 不自行拼接删除路径。
- Apps 页面展示真实路径、六类占用与已保留数据；CLI 增加 `app data list/delete`，开发态增加带 App id 确认的 `--reset-data`。
- `docs/USAGE.md`、打包 USAGE、双语文档和 `nextclaw-self-manage` Skill 已同步同一条安全主链路，不建议用户手工 `rm -rf`。

本批没有新增第二份数据 catalog，也没有承诺法证级安全擦除；外部授权文档不属于受管实例，purge 不会删除它们。完整设计与自审见 [App 数据生命周期管理设计](../../designs/2026-08-14-app-data-lifecycle-management.design.md)。过程证据见 [working-notes.md](work/working-notes.md)。

## 测试/验证/验收方式

- TSC：`@nextclaw/app-runtime`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/ui`、`nextclaw` 全部通过。
- 跨层定向测试：91 个通过（app-runtime 23、kernel 19、server 13、Client SDK 20、UI 8、CLI 8）。
- 真实 `.napp` 纵向测试覆盖 v0.1 安装、六类数据 27 bytes、v0.2 更新复用、默认卸载保留、重装恢复 sentinel、显式 purge 清空 inventory。
- 生产构建：上述 6 个 package 全部成功；NextClaw 打包 UI 资产已重新生成。
- 治理：`lint:new-code:governance`、backlog ratchet、Skill progressive loading、107 份双语文档镜像、14 项 App Client API 文档映射和 `git diff --check` 通过。
- CLI 构建产物实际运行 `app data --help`、`app data delete --help`、`app dev --help`，确认新命令和确认参数存在。

## 发布/部署方式

- 目标稳定产品版本：`nextclaw@0.36.0`，不包含 Desktop/DMG 发布。
- 使用仓库标准 stable NPM release flow 统一消费 changeset、发布 7 个变更包及 registry 中缺失的依赖闭包版本、生成 runtime update channel、GitHub Release 与用户 release notes，并部署/验证文档站。
- 本地 `master` 提交后推送 `origin/master`；任何 registry、GitHub 或部署步骤失败时按专项 release recovery 续跑，不重复已经成功的不可逆发布步骤。

## 正式发布结果

- 功能提交 `ca2c98ddc`、发布说明提交 `8d912b9d9`、稳定版提交 `26e1d3c7c` 均已推送到 `origin/master`；`nextclaw@0.36.0` tag 固定指向稳定版提交。随后 `master` 只增加交付事实记录，最终 branch closure 仍确认没有功能源码或发布产物只留在 release ref。
- `nextclaw@0.36.0` 已成为 NPM `latest`。7 个变更包之外，registry reconciliation 发现 15 个依赖闭包版本此前未发布，因此同一稳定批次实际补齐 22/22 个 package；没有额外版本 bump，也没有重复 publish。
- stable runtime workflow `31765994085` 全绿，darwin arm64/x64、linux x64、win32 x64 四个平台 bundle、签名 manifest 和汇总发布任务均成功；GitHub Release 为 `https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.36.0`。
- 四个平台公开 manifest 均为 `latestVersion: 0.36.0`、`minimumLauncherVersion: 0.18.11`、`hostKind: npm-runtime-bundle`，包含 bundle/manifest signature，并指向本版本英文说明。
- 公网隔离升级从 `nextclaw@0.35.0` 完成 `check -> download-only -> apply -> 新进程 0.36.0`；download-only 未提前切换 current pointer。
- 英文说明 `https://docs.nextclaw.io/en/notes/2026-08-14-nextclaw-v0-36-0` 与中文说明 `https://docs.nextclaw.io/zh/notes/2026-08-14-nextclaw-v0-36-0` 均已上线并返回 200；Docs Deploy `31765426169` 全绿。
- Desktop 不属于本次发布表面。push 自动触发的 desktop validation 首次仅因 GitHub release asset 下载连接重置失败；只重跑失败 job 后，Linux AppImage/deb/APT、Windows EXE/installer、macOS DMG 与 desktop runtime 全部通过，workflow `31765930306` 最终全绿。
- X 公告未完成：`@XiaotiaoWang` 的时间线排重无 v0.36.0；第一次写入在创建帖子前媒体上传网络失败，确认无隐藏落帖后只重试一次，第二次媒体成功但 X 以自动化风控错误 226 拒绝创建，且没有帖子 ID。按照回读与去重合同停止继续重试，因此不能报告 `NEXTCLAW_STABLE_READY` 全表面完成。

## 用户/产品视角的验收步骤

1. 安装一个 App，在 Apps 页面确认显示受管路径与六类数据占用。
2. 更新 App，确认原有个人数据仍可用且 instance 路径不变。
3. 卸载时保留默认选择，确认 App 消失、已保留数据出现。
4. 重装同一发布者 App，确认保留数据恢复；不同发布者不能接管。
5. 再次保留卸载，从“已保留的应用数据”永久删除，确认条目和受管目录消失。
6. 对 Workspace Service 分别选择保留和永久删除，确认源码、grants 与实例按选择处理。
7. 运行 `nextclaw app data list --json`；用返回的 data id 和 `--confirm <app-id>` 删除 retained 数据。

## 可维护性总结汇总

- 已尽最大努力改善可维护性：AppDataManager 是产品资格与投影 owner；app-runtime inventory/removal 是 metadata 与文件事务 owner；transport 和 UI 只消费公共合同。
- 第一轮自动审查发现 kernel composition、ServiceAppManager、Service App list item 与 CLI service 根目录 4 个硬阻断，已分别拆出 storage path、removal service、delete dialog 和 local-api 子目录。
- 第二轮自动审查为 0 error；主观复核确认没有把复杂度移到 wrapper、helper 或统计范围之外，也没有重复删除链。
- `nextclaw-kernel.ts` 384 行、`service-app.manager.ts` 599 行、`service-app-list-item.tsx` 486 行，均回到当前预算内；CLI service 根目录为 10 个直接文件。
- 新增/移动路径均经过 planned-path preflight，最终文件名、角色、feature root、公共导入与 effect owner 治理通过。
- 本批未触达 `maintainability-hotspots.mjs` 登记的红区文件。

## NPM 包发布记录

需要发布；这是用户可见的新增能力和公共 API 扩展，必须随同底层包统一进入稳定批次。

| Package | 原版本 | 发布版本 | 状态 |
| --- | ---: | ---: | --- |
| `nextclaw` | 0.35.0 | 0.36.0 | 已发布，`latest` 已反查 |
| `@nextclaw/app-runtime` | 0.11.0 | 0.12.0 | 已发布 |
| `@nextclaw/kernel` | 0.7.0 | 0.8.0 | 已发布 |
| `@nextclaw/server` | 0.15.29 | 0.16.0 | 已发布 |
| `@nextclaw/client-sdk` | 0.5.29 | 0.6.0 | 已发布 |
| `@nextclaw/ui` | 0.16.0 | 0.17.0 | 已发布 |
| `@nextclaw/core` | 0.16.0 | 0.17.0 | 已发布 |

依赖闭包另补齐 15 个已存在本地版本：`@nextclaw/companion@0.2.30`、7 个 channel extension `@0.2.26`、`@nextclaw/nextclaw-narp-runtime-opencode@0.2.27`、`@nextclaw/ncp-mcp@0.2.27`、`@nextclaw/mcp@0.3.27`、`@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.27`、`@nextclaw/remote@0.3.30`、`@nextclaw/runtime@0.4.26`、`@nextclaw/service@0.3.32`，同批 package tags 均指向稳定版提交。
