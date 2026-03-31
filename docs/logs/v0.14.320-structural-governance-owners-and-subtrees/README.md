# v0.14.320-structural-governance-owners-and-subtrees

## 迭代完成说明

- 为增量治理体系新增三条结构型检查：
  - `lint-new-code-closure-objects.mjs`：命中 touched factory 后，识别“闭包多方法对象应提升为 class / owner abstraction”的场景。
  - `lint-new-code-flat-directories.mjs`：命中 touched directory 后，识别“扁平混杂目录应生长出子树边界”的场景。
  - `lint-new-code-stateful-orchestrators.mjs`：识别“共享状态散落在多个顶层函数之间、缺少 owner abstraction”的场景。
- 抽出 `scripts/lint-new-code-governance-support.mjs` 作为共用 diff-only 支撑层，统一复用 changed file 发现、added line 采集与 AST walk，避免 governance 脚本本身继续复制膨胀。
- 将现有 `class-methods-arrow` 与 `object-methods-arrow` 迁移到共用支撑层，并继续保持 touched class / touched object 的边界语义。
- 将新规则接入 `pnpm lint:new-code:governance`，并补充单测覆盖关键 heuristic。
- 同步更新 `package.json` 命令入口、`post-edit-maintainability-guard` skill 文案与 `commands/commands.md`，保证说明和实际治理入口一致。

## 测试/验证/验收方式

- 运行：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node --test scripts/lint-new-code-class-methods.test.mjs scripts/lint-new-code-object-methods.test.mjs scripts/lint-new-code-closure-objects.test.mjs scripts/lint-new-code-flat-directories.test.mjs scripts/lint-new-code-stateful-orchestrators.test.mjs`
- 运行：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node scripts/lint-new-code-governance.mjs`
- 运行：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --no-fail --paths scripts/lint-new-code-governance-support.mjs scripts/lint-new-code-class-methods.mjs scripts/lint-new-code-object-methods.mjs scripts/lint-new-code-closure-objects.mjs scripts/lint-new-code-flat-directories.mjs scripts/lint-new-code-stateful-orchestrators.mjs`
- 验证点：
  - touched class / touched object 会整组抛出 eligible 成员，而不是只报单点。
  - touched closure-backed owner object 会被要求升级成 class / explicit owner。
  - touched flat mixed directory 会被要求长出 subtree，或显式写出豁免说明。
  - touched module-scope stateful orchestrator 会被要求收束到 owner abstraction。

## 发布/部署方式

- 本次变更为仓库治理脚本、测试与文档更新，无独立部署动作。
- 合并后，`pnpm lint:new-code:governance` 与 `pnpm lint:maintainability:guard` 会自动采用新的结构治理集合。
- 若某目录因装配边界确实必须长期保持扁平，可在目录 `README.md` 中新增 `## 子树边界豁免` 与 `- 原因：...` 作为显式例外。

## 用户/产品视角的验收步骤

1. 在一个 closure-backed factory、一个扁平混杂目录、或一个共享模块级状态的 orchestrator 文件中做最小改动。
2. 运行 `pnpm lint:new-code:governance`。
3. 确认输出不再只盯单个语法点，而是会给出 owner / subtree 级别的结构性告警。
4. 按提示把对象提升为 class/owner、把目录拆成子树、或把顶层状态编排收束到 owner abstraction 后再次运行，确认治理通过。
