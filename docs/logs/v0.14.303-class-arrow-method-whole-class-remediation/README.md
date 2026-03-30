# v0.14.303-class-arrow-method-whole-class-remediation

## 迭代完成说明

- 将 `scripts/lint-new-code-class-methods.mjs` 的失败提示补强为明确 remediation：命中 class 方法箭头函数治理时，默认按 class 边界统一修复可治理实例方法，而不是只修单个报错方法。
- 在 `AGENTS.md` 新增 `class-arrow-method-fix-by-class-boundary` 项目规则，正式要求这类问题默认整类修复，只有存在明确语义风险或用户要求缩 scope 时才允许例外。
- 在 `.agents/skills/post-edit-maintainability-guard/SKILL.md` 补充与增量治理脚本的联动说明，并要求输出中说明“当前 class 是否已整类修复”。

## 测试/验证/验收方式

- 运行 `node scripts/lint-new-code-class-methods.mjs --help`，确认脚本可正常加载。
- 运行 `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths scripts/lint-new-code-class-methods.mjs`，确认本次脚本改动未引入新的可维护性阻塞项。
- 人工检查 `AGENTS.md` 与 `.agents/skills/post-edit-maintainability-guard/SKILL.md`，确认“命中后按 class 边界整类修复”的规则与说明一致。

## 发布/部署方式

- 无需单独发布或部署。
- 随仓库后续正常提交、合并即可生效。

## 用户/产品视角的验收步骤

1. 在任意触达 class 的代码改动里引入一个普通实例方法写法 `foo() {}`。
2. 运行 `pnpm lint:new-code:governance` 或 `pnpm lint:maintainability:guard`。
3. 确认输出除了报具体违规位置外，还会明确提示“优先按当前 class 整类修复”。
4. 查阅 `AGENTS.md` 或 maintainability skill 文档，确认同一策略已被写成默认治理规则，而不是一次性口头约定。
