# v0.14.315-class-arrow-method-touched-class-scan

## 迭代完成说明

- 将 `scripts/lint-new-code-class-methods.mjs` 从“只检查新增 method 定义”升级为“只要 class 被本次 diff 触达，就扫描该 class 内所有可治理实例方法”。
- 保留 diff-only 边界：仍只看本次被触达的 class，不会把未触达 class 的历史普通实例方法一次性全仓抛出。
- 保留既有豁免：`constructor`、`get/set`、`static`、`abstract`、`override`、带 decorator 的方法继续跳过。
- 新增 `scripts/lint-new-code-class-methods.test.mjs`，覆盖“ touched class 全量抛出”“同文件未触达 class 不报”“既有豁免仍生效”三类关键行为。
- 同步更新 `post-edit-maintainability-guard` skill 文案，让文档描述和实际脚本行为保持一致。

## 测试/验证/验收方式

- 运行：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node --test scripts/lint-new-code-class-methods.test.mjs`
- 运行：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node scripts/lint-new-code-class-methods.mjs --help`
- 运行：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --no-fail --paths scripts/lint-new-code-class-methods.mjs scripts/lint-new-code-class-methods.test.mjs`
- 验证点：
  - 触达某个 class 后，该 class 内所有仍写成 `foo() {}` 的 eligible instance method 都会被一起报出。
  - 同文件中未触达的其它 class 不会被带出，避免退化成全文件或全仓噪音。
  - 既有 ignore 范围没有被破坏。

## 发布/部署方式

- 本次变更为仓库治理脚本与文档更新，无独立部署动作。
- 合并后，`pnpm lint:new-code:class-methods` 与 `pnpm lint:new-code:governance` 会自动采用新行为。
- 后续 AI 或人工只要触达某个 class，就会被迫按 class 边界整类处理同类实例方法。

## 用户/产品视角的验收步骤

1. 在某个已有 class 内随便修改一小处，比如补一行日志、改一个分支或新增一个箭头属性。
2. 保留该 class 里若干普通实例方法仍写成 `foo() {}`。
3. 运行 `pnpm lint:new-code:governance`。
4. 确认输出会把这个 touched class 里所有 eligible 的普通实例方法一起列出来，而不是只报当前新增/修改的那个点。
