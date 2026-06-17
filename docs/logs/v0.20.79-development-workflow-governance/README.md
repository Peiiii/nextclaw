# v0.20.79 Development Workflow Governance

## 迭代完成说明

本次把开发流程规范化为“一个总流程 owner + 多个阶段专项 skill”的结构：

- `nextclaw-delivery-workflow` 明确升级为标准开发流程/交付流程总 owner。
- 新增 `nextclaw-solution-design`，只负责方案设计阶段，不接管完整 workflow。
- `AGENTS.md` 增加方案设计阶段门和 skill 索引。
- `nextclaw-agent-instructions-governance` 增加 skill 反膨胀规则：修改 skill 前必须检查相邻职责重叠，能合并、统一、删除时不只追加内容。
- `directory-structure-governance-overview` 中的旧称同步为“标准开发流程”。

这次没有新增平行的 `development-workflow` skill，避免和已有 `nextclaw-delivery-workflow` 形成双 owner。

## 测试/验证/验收方式

- `git diff --check -- AGENTS.md .agents/skills/nextclaw-delivery-workflow/SKILL.md .agents/skills/nextclaw-agent-instructions-governance/SKILL.md .agents/skills/nextclaw-solution-design/SKILL.md .agents/skills/directory-structure-governance-overview/SKILL.md docs/designs/2026-06-17-chat-new-session-type-preference.design.md docs/logs/v0.20.79-development-workflow-governance/README.md`
- `pnpm lint:new-code:governance -- --files AGENTS.md .agents/skills/nextclaw-delivery-workflow/SKILL.md .agents/skills/nextclaw-agent-instructions-governance/SKILL.md .agents/skills/nextclaw-solution-design/SKILL.md .agents/skills/directory-structure-governance-overview/SKILL.md docs/designs/2026-06-17-chat-new-session-type-preference.design.md docs/logs/v0.20.79-development-workflow-governance/README.md`
- `node -e ...` 校验 `nextclaw-solution-design` 的 frontmatter name 与 description。

`skill-creator` 的 `quick_validate.py` 已尝试运行，但当前 Python 环境缺少 `yaml` 模块，未能作为最终校验来源。

## 发布/部署方式

不涉及部署。

## 用户/产品视角的验收步骤

后续当用户要求“规范开发流程”“方案到实现”“先设计再做”时：

1. AI 应先加载 `nextclaw-delivery-workflow` 作为总流程 owner。
2. 涉及方案设计阶段时加载 `nextclaw-solution-design`。
3. 方案设计完成后仍回到总流程继续实现、验证、收尾或明确停止在设计交付。
4. 修改 skill 时应先检查是否能合并、统一或删除冗余，不应只追加新规则。

## 可维护性总结汇总

本次是规则系统治理，未触达产品源码。维护性重点是减少流程 owner 混乱：

- 没有新增平行总流程 skill。
- 方案设计被定义为阶段专项 skill。
- 反膨胀规则进入已有治理 skill，而不是新增孤立规则。
- AGENTS 只保留索引和阶段门摘要，细节放入 skill。

## NPM 包发布记录

不涉及 NPM 包发布。
