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

目标版本为 v0.35.0。NPM/runtime、Marketplace Worker、提交与分支闭合状态在 Delivery 阶段更新；Desktop 不在本次授权范围。
