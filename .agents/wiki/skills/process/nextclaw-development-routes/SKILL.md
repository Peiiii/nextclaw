---
name: nextclaw-development-routes
description: 当共享 development-* 阶段触达 NextClaw 产品、仓库命令、运行实例或发布合同时使用；只补项目专项方法，不复制通用阶段状态。
---

# NextClaw 开发阶段专项路由

共享 `development-*` Skill 负责阶段与通用方法。本文件只拥有 NextClaw 产品、环境和发布的条件路由；每次只读取当前阶段命中的条目，不一次加载所有链接。项目授权和高层硬约束仍以根 `AGENTS.md` 为准。

## Lifecycle 与任务理解

- 意图宏命中时按 `commands/commands.md` 的对应条目展开；解释或引用不执行。
- 需要阶段追踪、Token/耗时、模型对比或本地 dashboard 时，读取[任务遥测方法](../development-task-telemetry/SKILL.md)。
- 切入 worktree、迁移草稿或主线并发时，读取[Worktree 合同](../../../../skills/development-lifecycle/references/parallel-worktree-development.md)。
- 大型交付启动即按[迭代日志治理](../../governance/nextclaw-iteration-log-governance/SKILL.md)建立持续记录，日期前缀优先、兼容版本号。新建工作入口采用共享的 `docs/work/YYYY-MM-DD-<slug>/working-notes.md`；已有迭代内笔记沿用，避免双份当前状态。普通跨轮笔记不强制建日志。
- 用户明确要求扫描、识别或清理死代码时，读取[NextClaw 死代码治理](../../operations/nextclaw-dead-code-governance/SKILL.md)。
- 长链路复现固定隔离的 `NEXTCLAW_HOME`、session、project root、provider/model/runtime 和 skill 集；按流式事件顺序、server/persisted/rendered truth、配置加载/保存快照及 skill 可用/实际选择定位第一个违约边界。
- Loop 设计归 `docs/loops`，执行批次、状态和证据归 `docs/logs`，按[迭代日志治理](../../governance/nextclaw-iteration-log-governance/SKILL.md)记录；设计与运行状态分离。

## Design

- NextClaw kernel/runtime host/manager/store/presenter 主干依赖：读取[Kernel Owner 架构](../../../../skills/development-design/references/nextclaw-kernel-owner-architecture.md)。
- 前端状态和 view logic：读取[View Logic 解耦](../../frontend/mvp-view-logic-decoupling/SKILL.md)。
- 目录、角色、命名：读取[文件组织治理](../../governance/file-organization-governance/SKILL.md)。
- fallback、兼容、恢复：读取[可预测行为优先](../../architecture/predictable-behavior-first/SKILL.md)。
- 前端系统性重构、控件交互、参考皮肤或页面级挑刺：分别选择[前端代码优化](../../frontend/frontend-code-optimization/SKILL.md)、[交互质量](../../frontend/frontend-interaction-quality/SKILL.md)、[参考皮肤复刻](../../frontend/replicating-reference-skins/SKILL.md)或[UI 设计挑刺](../../frontend/ui-design-critique/SKILL.md)中的一个。挑刺侧重删减、信息层级和空间效率；控件行为仍归交互质量。
- Hermes HTTP 或 NARP stdio runtime 接入：分别读取[HTTP runtime 接入](../../architecture/nextclaw-http-agent-runtime-integration/SKILL.md)或[NARP stdio 接入](../../architecture/nextclaw-narp-stdio-runtime-integration/SKILL.md)。
- 用户可见内容边界：读取[用户内容边界](../../content/user-facing-content-boundary/SKILL.md)。
- Marketplace skill 的评估与集成设计：读取[Marketplace skill 集成](../../operations/nextclaw-marketplace-skill-integration/SKILL.md)的 design 分支。

## Implementation

- 样式封装读取[前端样式封装](../../frontend/frontend-style-encapsulation/SKILL.md)；动态组件、列表 key、streaming UI 或需保持实例状态的界面读取[React 渲染生命周期安全](../../frontend/react-rendering-lifecycle-safety/SKILL.md)。
- 只有 `node/pnpm/npx/corepack` 无法从 PATH 解析，或实际 Node 与仓库 `.nvmrc` 不一致时，才读取[Node/pnpm 环境恢复](../../../../skills/development-implementation/references/node-pnpm-environment.md)。

## Validation

- 触达控件视觉状态、共享反馈或主题颜色时按[交互质量合同](../../frontend/frontend-interaction-quality/SKILL.md)选择渲染证据；纯逻辑和文案改动不触发。
- 用户已在真实实例复现，或任务触达冷/热启动、重复状态转换、journal/projection/hydrate、accepted run handle 或启动恢复时，读取[真实运行实例验证](../../../../skills/development-validation/references/runtime-instance-validation.md)。
- 需要隔离全局安装版验证时，按 diff 过构建资格门并读取[本地源码运行验证](../../../../skills/development-validation/references/local-source-runtime.md)；纯前端不得触发未变化的 Runtime/Cargo/CLI 构建。
- 验证 `packages/extensions/*` 未发布源码时读取[本地 Extension 源码验证](../../../../skills/development-validation/references/local-extension-source.md)。
- 触达 Desktop 内嵌 Runtime 的文件集合、native resources、bundle 复制规则或产物预算时，开发收尾先在当前平台运行一次 `pnpm -C apps/desktop bundle:build -- --channel stable`，通过后才运行远端多平台 Desktop 验证。
- 对指定 session/model 执行真实 NCP chat 时读取[NCP Chat 冒烟](../../../../skills/development-validation/references/ncp-chat-smoke.md)。
- L4 发布与不可逆变更读取[发布验证](../../../../skills/development-validation/references/release-validation.md)；runtime update 再读取[Runtime Update 验证](../../../../skills/development-validation/references/runtime-update-validation.md)。
- 新增/移动/重命名文件、改变 owner/目录/跨包依赖、触达治理敏感规则或提交前才运行 `lint:new-code:governance`；治理规则、baseline、相关脚本变化或提交/发布闭环才运行 `check:governance-backlog-ratchet`。

## Review

源码、脚本、测试或运行链路配置改动先运行一次 `node .agents/skills/development-review/scripts/check-maintainability.mjs`；范围明确时用 `--paths <touched-files...>`。`--non-feature` 只用于明确要求非测试净增 `<= 0` 的治理/减债任务，不是普通 bugfix、refactor 或 cleanup 的默认选项。脚本结果与人工 Review 分开报告。

## Delivery

每个决策只进入当前需要的一个 owner：

- 提交范围、changeset、版本笔记和用户可见更新摘要：[Release Notes 方法](../../operations/nextclaw-release-notes/SKILL.md)。
- 重要交付、跨模块长链路、红区和发布留痕：[迭代记录治理](../../governance/nextclaw-iteration-log-governance/SKILL.md)。
- 有独立用户任务、可核查证据和公开叙事价值的产品成果：`nextclaw-product-blog-storytelling`。
- NextClaw NPM package、runtime channel、真实安装和分支闭环：[NPM 发布方法](../../operations/nextclaw-npm-release/SKILL.md)。
- NextClaw Desktop installer、DMG、update manifest、发布和恢复：[Desktop 发布方法](../../operations/nextclaw-desktop-release/SKILL.md)。
- Marketplace skill 发布：[Marketplace skill 集成](../../operations/nextclaw-marketplace-skill-integration/SKILL.md)的 publishing 分支。

项目发布语义、内容候选、人工介入计数和 Git 主线闭合只在实际交付或发布时读取[NextClaw 交付合同](references/delivery.md)。

## Retrospective

- 流程、方法、宏、AGENTS 或模型补丁改进由 `nextclaw-agent-instructions-governance` 读取[规则资产生命周期](../../../../skills/nextclaw-agent-instructions-governance/references/rule-asset-lifecycle.md)；共享受管文件的改进回到独立仓库，再同步到本项目。
- 有独立交付意义的重要批次留痕读取[迭代记录治理](../../governance/nextclaw-iteration-log-governance/SKILL.md)。
