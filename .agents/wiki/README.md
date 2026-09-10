# AI 开发 Wiki

这里保存不会进入仓库顶层 Skill 发现列表、只由当前 Skill 按需读取的下级 Skill 与共享知识。

- [`skills/`](skills/README.md)：按领域分组的完整下级 Skill；叶子目录保留 `SKILL.md`、frontmatter、references 和 scripts，由上级显式加载。
- [`knowledge/`](knowledge/README.md)：事实、背景、术语、案例与权威来源索引；只提供证据，不拥有流程、授权或强制力。

单一 Skill 独享的条件内容留在该 Skill 的 `references/`。只有存在至少两个真实消费者、或需要保留独立可复用合同的能力才进入 `wiki/skills`；可确定行为优先由脚本或测试保证。`wiki/knowledge` 禁止 `SKILL.md` 和 skill frontmatter，防止事实资料伪装成执行规则。
