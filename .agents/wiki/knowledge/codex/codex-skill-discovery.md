# Codex Skill 发现机制

## 当前已验证事实

- 来源：[OpenAI 官方 Build skills 文档](https://learn.chatgpt.com/docs/build-skills)。
- 适用范围：ChatGPT 与 Codex 的 Agent Skills；本条目重点记录 Codex 本地发现行为。
- 验证时点：2026-09-10。
- Codex 初始只提供每个 skill 的名称、description 和文件路径；决定使用后才读取完整 `SKILL.md`。
- 初始 skill 列表最多占模型上下文窗口的 2%；上下文窗口未知时使用 8,000 字符上限。skill 过多时先缩短 description，仍过大时可能遗漏部分 skill 并提示。
- 隐式命中依赖 description，因此入口描述需要短、边界清楚，并把主要意图和触发词放在前面。
- Codex 从当前目录到仓库根沿途扫描 `.agents/skills`，同时还会加载用户、管理员、系统和插件来源的 skill。repo 预算必须给其它来源留空间，不能把 8,000 字符视为仓库独占额度。
- Skill package 是含 `SKILL.md` 的目录；是否进入仓库自动发现面取决于它是否位于 Codex 扫描的 `.agents/skills` 根下。仓库约定允许 `.agents/wiki/skills/<group>/<skill>/SKILL.md` 保留完整 Skill 结构，但它属于显式文件路由的下级 Skill，不会自动出现在可用 Skill 列表。

## 仓库观测入口

运行 `pnpm check:skill-progressive-loading` 获取当前顶层数量、分组 Wiki Skill 数量、description 字符、discovery 代理、入口正文体积和 Wiki 非发现性结果。discovery 代理只统计 `.agents/skills`，由名称、description、仓库相对路径及保守分隔开销组成，不声称等于 Codex 内部精确序列化字节。

## 维护

OpenAI 文档、Codex 发现行为或上下文预算发生变化时原地复核本条目和治理脚本。历史数字进入迭代记录，不在本页累积时间序列。
