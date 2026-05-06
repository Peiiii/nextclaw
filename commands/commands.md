# Commands

本文件只记录“本项目管理/协作/治理相关”的元指令，定位类似项目协作协议。不要收录 package 命令、产品 CLI 命令、部署脚本命令或业务执行命令；这些内容应写入对应产品、功能或发布文档。

命令细节应尽量指向可触发 skill，而不是在本文件展开长流程。

## `/new-command`

- 用途：新增一条项目管理/协作/治理元指令。
- 输入格式：`/new-command <command-name> <purpose>`
- 输出/期望行为：先判断是否属于本文件范围；若属于，补齐名称、用途、输入格式、输出/期望行为，并同步 `AGENTS.md` 命令索引。

## `/config-meta`

- 用途：调整或更新 `AGENTS.md`、命令机制、Rulebook / Project Rulebook 遗留内容、skill 分层或项目 AI 指令。
- 输入格式：`/config-meta <要调整的问题或目标>`
- 输出/期望行为：必须使用 `nextclaw-agent-instructions-governance`；先判断应删减、合并、迁入 skill、修正已有规则还是新增常驻规则；优先处理深层机制问题，避免表层补丁。默认把“规范”理解为包含 `AGENTS.md`、skills、`commands/commands.md`、相关 `docs/*`、`scripts/governance/*` 与对应 baseline/test 的完整系统，不能只改文档不检查脚本侧影响。收尾时按 `nextclaw-iteration-log-governance` 判断是否需要 `docs/logs` 留痕。

## `/add-to-plan`

- 用途：将想法或用户建议纳入规划体系。
- 输入格式：`/add-to-plan <一句话事项>`，可附来源、优先级、owner。
- 输出/期望行为：默认写入 `docs/TODO.md` 的 `Inbox`，给出 `Now / Next / Later / Roadmap Candidate` 分流建议，并生成 Issue 草案；若属于中长期方向，同步更新 `docs/ROADMAP.md`。

## `/check-meta`

- 用途：检查 `AGENTS.md`、命令机制和 skill 分层是否自洽。
- 输入格式：`/check-meta`，可附聚焦范围。
- 输出/期望行为：必须使用 `nextclaw-agent-instructions-governance`；检查过度常驻、重复规则、普通文档承载强制流程、skill 触发描述缺失、命令索引漂移等问题，并给出修复建议或直接修复低风险问题。

## `/new-rule`

- 用途：新增或固化一条项目协作/治理规则。
- 输入格式：`/new-rule <规则意图>`
- 输出/期望行为：必须先判断规则应进入 `AGENTS.md` 常驻内核、已有 skill、新 skill，还是普通文档；只有“每轮都必须知道”的高优先级规则才进入 `AGENTS.md`。规则本质若是约束系统行为，应优先固化清晰、可预测、无隐藏兜底的高层原则。

## `/commit`

- 用途：提交当前变更。
- 输入格式：`/commit`，可附提交范围或说明。
- 输出/期望行为：只有用户明确发出该命令或等价提交请求时才执行；提交信息必须使用英文。提交前确认暂存范围，不纳入无关用户改动。

## `/close-task`

- 用途：对当前任务执行标准交付收尾流程。
- 输入格式：`/close-task`，可附聚焦范围或说明。
- 输出/期望行为：使用 `nextclaw-delivery-workflow` 作为总流程 owner；统一检查是否完成实现前删减判断、定向验证、`tsc` 适用性、maintainability guard/review、总代码与非测试代码增减披露、复盘机制改进、迭代留痕决策与最终主动汇报。若相关项缺失，不得视为真正收尾完成。

## `/maintainability-review`

- 用途：对本次代码相关改动执行独立于实现阶段的可维护性复核。
- 输入格式：`/maintainability-review`，可附 `<paths...>` 聚焦范围。
- 输出/期望行为：使用 `post-edit-maintainability-review`；输出固定模块 `长期目标对齐 / 可维护性推进`、`可维护性复核结论`、`本次顺手减债`、`代码增减报告`、`非测试代码增减报告` 与简短 `可维护性总结`。

## `/validate`

- 用途：按改动影响范围执行最小充分验证。
- 输入格式：`/validate`，可附验证范围。
- 输出/期望行为：使用 `nextclaw-validation-workflow`；若触达 TypeScript 源码、类型声明、导入导出边界或运行链路，必须包含实际执行的 `tsc` 命令；代码改动需覆盖 maintainability guard、governance ratchet、主观可维护性复核和必要冒烟。

## `/release-frontend`

- 用途：前端一键发布，仅 UI 变更场景。
- 输入格式：`/release-frontend`
- 输出/期望行为：生成 UI changeset，并执行既有前端发布流程；最终说明发布包、版本、验证和不适用项。

后续指令在此追加，保持“用途 / 输入格式 / 输出期望”结构，并同步 `AGENTS.md` 索引。
