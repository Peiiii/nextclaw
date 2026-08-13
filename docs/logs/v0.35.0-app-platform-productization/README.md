# v0.35.0 App Platform 产品化

## 目标

把 Mini App、Panel App、Service App 收敛为可安装、可运行、可更新、可回滚、可卸载、可发布的统一 App Platform，优先闭合实例存储、运行时信任和发布风险真实性。

## 设计

- [App Platform 产品化设计](../../designs/2026-08-14-app-platform-productization.design.md)
- [工作记录](work/working-notes.md)

## 交付范围

- App Instance 结构化存储与旧数据迁移。
- package/workspace/dev Service 一致的运行时存储上下文。
- schema v2 runtime/storage/capability 归一化与真实风险摘要。
- 更新候选版本预检、完整性和运行时 probe 前置。
- Marketplace 社区原生 Service 上架策略。
- Apps 管理面的隔离级别与数据可见性。

## 验证

- App runtime、kernel、server、client SDK、UI、NextClaw CLI 和 Marketplace Worker 构建与 TypeScript 检查通过。
- 定向/全量边界共 174 项测试通过；其中包含真实 `.napp` 的 pack、validate、registry install、Service run、故障更新恢复和卸载保留数据链路。
- new-code governance、backlog ratchet、定向 ESLint 和发布 tarball 验证通过。
- 最终 diff-only maintainability Review 为 0 error、no findings。

## 发布

- 功能提交 `298233cac`、发布说明提交 `05b72ac1f` 和稳定版本提交 `eab1f2614` 已进入并推送 `master`；九个 package tag 与发布提交一致。
- `nextclaw@0.35.0` 与同批八个 `@nextclaw/*` 包已发布到公开 NPM registry，精确版本冷安装验证了 CLI version、App/launcher entry、update public key 和 embedded UI。
- stable runtime workflow [31737711368](https://github.com/Peiiii/nextclaw/actions/runs/31737711368) 的 darwin arm64/x64、linux x64、win32 x64 与 channel publish job 全部成功；[GitHub Release](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.35.0) 和四平台公开 manifest 已验证。
- 从公开 registry 冷装 `nextclaw@0.34.0` 后，真实完成 `check -> download-only -> apply -> 新进程 0.35.0`；download-only 没有提前切换 current pointer，apply 返回 restart-required。
- Marketplace Worker 已部署到 `marketplace-api.nextclaw.io` / `apps-registry.nextclaw.io`，Version ID 为 `54de726b-a835-4083-a8ed-195de68fad31`；health、plugins、skills、Apps v1/v2 线上冒烟通过。
- 双语版本说明已由 Docs Deploy [31737092325](https://github.com/Peiiii/nextclaw/actions/runs/31737092325) 上线，公开部署 commit/tree 校验通过。
- X 公告未完成：`@XiaotiaoWang` 写入前已刷新当前 GraphQL query ID，但 X 返回日发送限额错误 344；时间线回读确认没有隐藏落帖，因此没有盲目重试或制造重复帖。
- Desktop 不属于本次常规 NextClaw stable 授权范围，未发布 installer/DMG/update channel。

GitHub Actions 仅报告旧 Node 20 action runtime 的弃用提示，runner 已自动使用 Node 24；本次没有失败 job，该提示保留为后续 CI 基础设施债务。
