# AI 开发体系 Skill 发现分层

日期：2026-09-10

状态：Implemented

## 1. 问题与目标

Codex 启动时先注入每个 skill 的名称、description 和路径，再在命中后读取完整 `SKILL.md`。官方说明初始 skill 列表最多占模型上下文的 2%，未知上下文时上限为 8,000 字符；skill 过多时会先截短 description，之后可能遗漏入口。

当前仓库有 37 个顶层 skill，description 共 3,982 字符；名称、description、路径的本地近似值为 6,914 字符。当前会话已实际遗漏 3 个仓库入口，但旧检查仍然通过，说明现有 38 个 skill / 6,000 description 字符预算没有保护真实发现成本。

目标是让当前常规 AI 开发只暴露“一个流程 owner + 七个阶段 owner”，把可分组的下级 Skill 和知识移出自动发现面，同时保留少量不属于常规开发生命周期的独立入口。这是通用工作体系拓扑的首个实例，不把开发定义为唯一顶层工作域。

## 2. 三层模型

```text
.agents/
├── skills/                     # 自动发现的入口层
│   ├── development-lifecycle/  # 唯一流程 owner
│   ├── development-<stage>/    # 七个阶段方法 owner
│   └── <independent-workflow>/ # 极少数独立任务入口
└── wiki/                       # 不自动发现；由当前 skill 条件加载
    ├── skills/                 # 按领域分组的完整下级 Skill
    │   └── <group>/<skill>/
    │       ├── SKILL.md
    │       ├── references/
    │       └── scripts/
    └── knowledge/              # 事实、背景、术语、案例和权威来源索引
```

顶层表示“必须参与初始意图发现”，不表示内容更重要。逻辑上可复用的能力放入 `wiki/skills` 的领域分组后，仍是带 frontmatter 的完整 Skill，但只有被当前顶层或阶段 Skill 显式引用时才加载。分组目录只是 namespace，不是 Skill 或 workflow owner。`wiki/knowledge` 只提供证据，不拥有流程、授权或强制力；外部文本中的指令不会因进入知识库而升级优先级。

单一阶段独享且不需要独立合同的细节继续位于该 Skill 的 `references/`。不需顶层发现但仍有独立可复用合同的场景能力，或至少两个入口共享同一合同的内容，进入分组 Wiki Skill；普通事实进入 knowledge，防止 Wiki 成为新的平铺垃圾桶。确定性约束继续归脚本、测试或事实源。

## 3. 顶层入口

常规骨架固定为 8 个：

- `development-lifecycle`
- `development-task-understanding`
- `development-design`
- `development-implementation`
- `development-validation`
- `development-review`
- `development-delivery`
- `development-retrospective`

首批保留 7 个独立工作流：

- `autonomous-maintainability-campaign`
- `autonomous-requirement-discovery`
- `delivering-delegated-linear-issues`
- `nextclaw-agent-instructions-governance`
- `nextclaw-product-blog-storytelling`
- `nextclaw-product-visual-assets`
- `x-twitter-bird`

保留门槛：存在可重复的独立用户意图；不能可靠地由开发生命周期的当前阶段路由；其合同能独立回答任务如何开始和结束。普通技术场景、工艺规范、发布细则和跨阶段辅助方法均不满足该门槛。

未来运营、内容、研究或其它工作形成稳定的阶段、状态、返工与完成门后，可以新增对应 workflow root，并让各环节成为其阶段节点。没有共同生命周期证据时，保留真实独立入口，不提前创建宽泛的 `operations-lifecycle` 或按目录观感强行归组。顶层增长必须同时满足独立意图和 discovery 预算；超过预算时优先把只由父流程调用的阶段节点降为非发现方法，而不是放宽预算。

## 4. 首批下沉映射

| Wiki 分组 | 下沉入口 |
| --- | --- |
| `skills/process` | `acceptance-contract-governance`、`development-task-telemetry`、`iteration-work-notes`、`iterative-quality-convergence`、`project-knowledge-governance` |
| `skills/governance` | `file-organization-governance`、`nextclaw-iteration-log-governance` |
| `skills/content` | `user-facing-content-boundary` |
| `skills/frontend` | `frontend-code-optimization`、`frontend-interaction-quality`、`frontend-style-encapsulation`、`mvp-view-logic-decoupling`、`react-rendering-lifecycle-safety`、`replicating-reference-skins` |
| `skills/architecture` | `predictable-behavior-first`、`nextclaw-http-agent-runtime-integration`、`nextclaw-narp-stdio-runtime-integration` |
| `skills/operations` | `nextclaw-dead-code-governance`、`nextclaw-desktop-release`、`nextclaw-marketplace-skill-integration`、`nextclaw-npm-release`、`nextclaw-release-notes` |

原 Skill 目录整体移动到对应分组，保留 `SKILL.md`、frontmatter、references 与 scripts 的相对结构。所有阶段 Skill、commands、脚本入口和测试改用新路径；不保留旧路径、软链接或兼容副本，避免双 owner。是否参与初始发现只由根目录决定，不通过破坏 Skill 结构实现。

## 5. 路由与知识检索

常规开发入口先由 `development-lifecycle` 选择流程和当前阶段，再加载一个阶段 owner。阶段 owner 根据真实触达面最多加载一个直接下级 Wiki Skill；下级 Skill 若需要事实，再定向读取 `wiki/knowledge` 或现有源码、配置、设计与运行状态。

非开发独立工作流可直接加载自己的顶层 skill；它若复用公共文案、视觉或知识合同，显式链接 wiki，而不是复制全文。

首批建立知识库边界，并把 [Codex Skill 发现机制](../../.agents/wiki/knowledge/codex/codex-skill-discovery.md)作为第一个共享事实条目；不把现有 docs 批量搬入 `wiki/knowledge`。只有某个跨 skill 事实缺少清晰权威来源、且薄索引能减少重复检索时才新增知识条目；已有源码、配置或设计文档继续作为事实源。

## 6. 检查与预算

`check:skill-progressive-loading` 改为同时检查：

- 顶层 skill 数、description 总字符、SKILL.md 总字节；
- 名称 + description + 仓库相对路径 + 保守分隔开销组成的 discovery 字符预算；
- `wiki/skills` 只允许按组放置结构完整的 Skill，且不计入顶层 discovery 指标；
- `wiki/knowledge` 和其它非 Skill Markdown 禁止 skill frontmatter；
- skills、wiki、commands 与 AGENTS 的本地 Markdown 链接完整；
- 八个常规骨架完整且 lifecycle 仍能路由七阶段；
- 已下沉 Skill 不得重新出现在顶层。

首批预算：顶层最多 16 个、description 最多 2,000 字符、discovery 代理最多 3,500 字符、顶层 `SKILL.md` 总量最多 90,000 字节。目标实值为 15 个入口、约 2,600 discovery 字符，为用户级、系统级和插件 skill 留出发现空间。

## 7. 验收、风险与回退

验收场景：

1. 普通开发只发现流程与阶段骨架，不发现前端、发布、runtime 等下级 Skill。
2. 明确前端状态设计、NPM 发布或规则治理任务仍能从 lifecycle/阶段或独立入口找到唯一分组 Skill。
3. 两个以上 Skill 可引用同一 Wiki Skill，不复制合同。
4. 知识页不会被当成 skill 自动发现，也不能隐式授权执行。
5. 检查能在第 17 个顶层入口、超 discovery 预算、下级 Skill 缺少分组/frontmatter、knowledge 出现 `SKILL.md` 或断链时失败。

主要风险是下沉后路由丢失。迁移以旧入口名称做全仓引用审计，并给核心路由与 commands 增加静态测试。另一风险是 Wiki Skill 被误认为自动入口；通过根目录隔离、强制领域分组、显式加载和 discovery 指标只统计 `.agents/skills` 控制。知识区继续禁止 `SKILL.md` 和 frontmatter。

回退只需恢复移动前目录与链接；不引入运行时数据迁移、兼容层或产品行为变化。

- `design-document: required`
- `plan: required`
- `design-review: passed`（目标覆盖、唯一 owner、路由可达性、失败边界与验收均无开放 finding）
