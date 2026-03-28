# v0.14.263-code-review-skill

## 迭代完成说明

- 新增可复用通用 skill：[code-review](../../../.codex/skills/code-review/SKILL.md)。
- 新增 skill UI 元信息文件：[agents/openai.yaml](../../../.codex/skills/code-review/agents/openai.yaml)，补齐展示名、短描述与默认提示词。
- 在 skill 的 `Review Rules` 中固化 `delete-simplify-before-add` 原则，要求代码 review 时优先判断“能否删除”“能否简化”，最后才建议新增逻辑。

## 测试/验证/验收方式

- 运行 `python3 /Users/tongwenwen/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/code-review`
  - 预期输出 `Skill is valid!`。
- 运行 `test -f .codex/skills/code-review/SKILL.md`
  - 预期 skill 主文件存在。
- 运行 `test -f .codex/skills/code-review/agents/openai.yaml`
  - 预期 UI 元信息文件存在。
- 说明：本次仅新增 skill 文档与元信息，不触达构建、类型检查或运行时代码路径，`build`、`lint`、`tsc` 不适用。

## 发布/部署方式

- 本次改动不涉及 npm 包发布、服务部署、数据库迁移或桌面打包。
- 合入后，该 skill 可作为仓库本地 Codex skill 使用，路径为 `.codex/skills/code-review`。

## 用户/产品视角的验收步骤

1. 打开 [SKILL.md](../../../.codex/skills/code-review/SKILL.md)，确认其用途为“代码 review / PR review / findings-first audit”。
2. 确认 `Review Rules` 中存在 `delete-simplify-before-add` 规则，并且内容明确要求“先删减、再简化、最后才新增”。
3. 打开 [agents/openai.yaml](../../../.codex/skills/code-review/agents/openai.yaml)，确认展示名为 `Code Review`，短描述与默认提示词已配置。
4. 运行 skill 校验命令，确认输出 `Skill is valid!`。
