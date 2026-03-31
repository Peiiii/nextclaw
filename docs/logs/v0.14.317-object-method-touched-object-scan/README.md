# v0.14.317-object-method-touched-object-scan

## 迭代完成说明

- 将 `scripts/lint-new-code-object-methods.mjs` 从“只检查新增 object method shorthand”升级为“只要 object literal 被本次 diff 触达，就扫描该对象里所有 eligible method shorthand”。
- 保留增量治理边界：仍只检查本次触达的 object literal，不会把未触达对象或全仓历史 shorthand 一次性拉出来。
- 保留既有忽略范围：`get/set` 继续跳过，不和普通 method shorthand 混在一起报。
- 新增 `scripts/lint-new-code-object-methods.test.mjs`，覆盖“touched object 全量抛出”“同文件未触达对象不报”“getter/setter 继续忽略”三类关键行为。
- 说明层面明确：这条规则继续走 `pnpm lint:new-code:governance` 增量治理，不下沉为全仓 ESLint 主规则，避免历史代码一次性爆炸。

## 测试/验证/验收方式

- 运行：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node --test scripts/lint-new-code-object-methods.test.mjs`
- 运行：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node scripts/lint-new-code-object-methods.mjs --help`
- 运行：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --no-fail --paths scripts/lint-new-code-object-methods.mjs scripts/lint-new-code-object-methods.test.mjs`
- 验证点：
  - 只要对象字面量被触达，该对象里所有 `foo() {}` 形式都会被一起报出。
  - 同文件未触达的其它对象不会被连带报出。
  - `get/set` 不会误报成 object shorthand 违规。

## 发布/部署方式

- 本次变更为仓库治理脚本与测试补强，无独立部署动作。
- 合并后，`pnpm lint:new-code:governance` 会自动采用新的 touched-object 行为。
- 后续如需进一步统一到 ESLint 主规则，应先解决“如何避免一次性炸出历史代码”的策略问题；本次不做该迁移。

## 用户/产品视角的验收步骤

1. 在某个已有 object literal 内随便改一小处，比如改一行逻辑或补一个属性。
2. 保留该对象里的若干 shorthand method 仍写成 `foo() {}`。
3. 运行 `pnpm lint:new-code:governance`。
4. 确认输出会把这个 touched object 里的所有 eligible shorthand method 一起列出来，而不是只报当前新增的那个点。
