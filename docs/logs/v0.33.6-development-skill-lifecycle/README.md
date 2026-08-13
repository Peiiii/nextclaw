# Development Skill 生命周期重构

## 迭代完成说明

本轮把项目核心开发 skill 从多个命名不一致的平级入口重构为一条标准生命周期：`development-lifecycle` 是唯一默认流程 owner，Discovery、Design、Implementation、Validation、Review、Delivery、Retrospective 分别由七个统一命名的阶段 owner 承担。

前一轮渐进加载治理已经解决默认全家桶、入口膨胀和依赖循环，但调查、设计、验证、code review、guard 与发布流程仍需要使用者自行还原为开发过程，Implementation、Delivery、Retrospective 也缺少对称 owner。本轮在不回退渐进加载成果的前提下，把生命周期升级为一级信息架构。

主要结果：

- 建立一个生命周期 owner 和七个阶段 owner，统一进入、输入、输出、返工和越权边界；
- Validation 只证明行为和合同，Review 统一承担 findings-first 与 diff-only maintainability 自动检查；
- Delivery 统一结果交接和授权边界，NPM/runtime、Desktop 等发布合同继续由 NextClaw 专项 owner 承担；
- Retrospective 默认轻量执行，只有重复、可复用或高影响经验才进入知识、迭代、规则、测试或 script owner；
- 通用阶段使用 `development-*`，只有依赖 NextClaw 产品、NCP、Kernel、仓库命令或发布合同的能力使用 `nextclaw-`；
- AGENTS、commands、package script 和活动 skill 引用全部切换到新名称；历史设计与迭代记录保留原名作为事实记录；
- skill 渐进加载检查新增生命周期拓扑、阶段越权、目录/frontmatter 一致和精确退役名称验证。

Review 期间发现少数专项 skill 仍自行编排 validation/guard/交付，已统一改为“完成当前领域 slice 后返回生命周期”，避免专项入口重新获得阶段切换权。

设计依据：[`docs/designs/2026-08-14-development-skill-lifecycle.design.md`](../../designs/2026-08-14-development-skill-lifecycle.design.md)。

## 测试/验证/验收方式

- `node --test scripts/governance/checks/skill-progressive-loading.test.mjs`：7 个测试通过，覆盖最小目录、循环/断链、重复/退役名称、reference frontmatter、精确名称匹配、标准 1+7 拓扑和阶段越权。
- `node --test .agents/skills/development-review/scripts/maintainability-guard-*.test.mjs`：13 个测试通过，证明 Review 自动检查移动后行为保持有效。
- `pnpm check:skill-progressive-loading`：34 个入口、128659 字节入口正文、3936 字符 description、9178 字节 AGENTS、32 条依赖边，结果通过且无循环。
- `pnpm exec eslint ...`：本轮触达的治理脚本、测试和 Review scripts 定向 ESLint 通过。
- `pnpm lint:new-code:governance -- <本轮范围>`：文件/目录命名、模块结构、公共导入、参数变异、上下文解构、owner 和其它新代码治理检查全部通过。
- `pnpm check:governance-backlog-ratchet`：通过，未扩大既有治理债务。
- `pnpm lint:new-code:doc-file-names -- docs/designs/2026-08-14-development-skill-lifecycle.design.md docs/logs/v0.33.6-development-skill-lifecycle/README.md`：文档命名检查通过。
- `bash -n` 与真实执行 `development-implementation/scripts/locate-node-pnpm.sh`：迁移后的 Node/pnpm 恢复入口有效。
- `git diff --check`：无空白错误。

本轮没有触达 TypeScript、产品运行链路或 UI 行为，因此 tsc、产品测试和真实产品冒烟不适用。

## 发布/部署方式

不涉及产品发布或部署。本轮不添加 changeset，不执行 commit、push、PR、NPM/runtime/Desktop release，也不重启任何 NextClaw 实例。

## 用户/产品视角的验收步骤

1. 查看 `.agents/skills/development-*`，确认存在 lifecycle 与七个阶段 owner，且名称和阶段职责一致。
2. 查看 `AGENTS.md`，确认普通开发只进入 lifecycle，明确阶段请求可直接进入对应阶段 owner。
3. 查看 `commands/commands.md`，确认 `/close-task`、`/validate`、`/maintainability-review`、`/commit` 和 `/release-*` 已路由到新 owner。
4. 运行 `pnpm check:skill-progressive-loading`，确认 1+7 核心完整、阶段无互相路由、旧名称无活动引用且依赖无环。
5. 检查 NPM、Desktop、runtime integration、产品博客和产品视觉素材 skill，确认深耦合能力使用 `nextclaw-` 前缀。

## 可维护性总结汇总

本轮通过职责收敛减少平级流程 owner：Review 自动脚本没有复制，原 guard 目录整体迁入 Review；Discovery、Design、Implementation 和 Validation 的 references/scripts 以移动为主，未把旧入口原样复制成第二套合同。

自动 maintainability 检查覆盖 14 个脚本文件，结果为 0 error、2 warning：`maintainability-guard-support.mjs` 415/500 行，`skill-progressive-loading.mjs` 416/500 行。前者仍是 Review 自动检查的单一 support owner，后者新增的生命周期拓扑检查与原渐进加载审计属于同一事实域；当前拆分会增加名字和跳转，未形成阻塞 finding。守卫报告的大量净增长来自 Git 尚未暂存时目录移动被视为删除加未跟踪新增，不代表复制了第二份实现。

完整新代码治理首次复验发现迁移后的既有脚本存在参数变异和重复上下文读取，已分别改为返回值式聚合和局部解构；同一入口复验后全部通过。主观 Review 最终为 `no findings`。

目录和文件 planned-path preflight 已在首次编辑前执行；新增设计和迭代路径也分别补充预检。工作区原有 `packages/nextclaw/ui-dist` 生成物变动未触碰、未恢复、未纳入本轮范围。

## NPM 包发布记录

不涉及 NPM 包发布。
