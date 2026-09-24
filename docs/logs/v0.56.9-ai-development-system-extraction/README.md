# AI 开发体系独立仓库抽取与 NextClaw 接入

## 迭代完成说明

本批把可复用的开发流程、阶段方法、知识治理与规则资产治理抽到独立仓库 [ai-development-system](https://github.com/Peiiii/ai-development-system)，上游实现版本 `5a487d37268cecc431158fc4756f00dff22fbaad`。NextClaw 作为首个消费者，通过逐文件 lock 锁定上游内容；根 `AGENTS.md` 继续由本项目维护，使用 `--agents=skip` 避免重复常驻规则。

原阶段 Skill 中涉及 NextClaw Kernel、worktree、运行实例、NCP、前端专项、发布和治理脚本的条件路由，集中保留在[项目专项路由](../../../.agents/wiki/skills/process/nextclaw-development-routes/SKILL.md)及其按需 reference。其它项目安装共享 payload 时不会获得 NextClaw 产品或历史授权。迁移账本在上游 `docs/migration/nextclaw.md`；原项目的专项 references、脚本、commands、产品知识和历史设计均未删除。

## 测试/验证/验收方式

- 上游 `npm run check`：41 个受管文件的 manifest、frontmatter、相对链接和项目身份检查通过。
- 上游 `npm test`：5 个同步场景通过，覆盖安装、升级、`AGENTS.md` 项目段落保留、受管文件冲突、受管常驻段冲突及 dry-run。
- 隔离空项目真实执行 `install` 与 `check`，首次写入 41 个受管文件、共享根规则和 lock，检查返回匹配。
- 本项目 `pnpm check:skill-progressive-loading`、`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet` 均通过；上游同步器 `check --target` 返回匹配。
- 本批只改指令 Markdown、同步 lock 与项目专项路由，未触达产品 TypeScript 或运行链路；不适用 tsc、产品构建和真实产品冒烟。跨 Agent 工具与真实第二项目仍待后续消费者验证。

## 发布/部署方式

独立仓库已推送 GitHub 私有仓库。NextClaw 本批只进行规则资产接入与适用 Git 交付，不发布 NPM、Runtime、Desktop 或文档站；没有用户可见产品功能变化。

## 用户/产品视角的验收步骤

1. 在独立仓库阅读 `README.md` 与方案设计，确认共享方法和 NextClaw 项目层的边界。
2. 对空 Codex 项目运行 `node bin/ai-development-system.mjs install --target <project>`；确认根 `AGENTS.md`、八个 `development-*` Skill、下级 Wiki 方法和 lock 出现。
3. 运行 `check --target <project>`；预期显示安装内容与上游匹配。修改受管 Skill 后再执行 `upgrade`；预期显式拒绝覆盖本地改动。
4. 在 NextClaw 读取根 `AGENTS.md` 的项目路由；涉及产品、实例或发布的任务按专项路由读取对应方法，通用阶段仍由共享 `development-*` owner 决定。

## 可维护性总结汇总

原阶段 Skill 的项目分支收敛到一个项目级路由，通用方法只有独立仓库一个上游 owner；受管文件逐项记录摘要，目标项目专项文件不在 manifest 中。未新增产品代码层、平行 lifecycle 或运行时适配。NextClaw 自动 diff-only maintainability 检查对本批无 code-like 文件，报告不适用；规则拓扑与治理检查通过。后续需用真实第二项目观察规则触发质量和升级成本，不以静态检查替代长期效果。

## NPM 包发布记录

不涉及 NPM 包发布。
