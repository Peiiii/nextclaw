# v0.15.28-maintainability-guard-eslint-reuse

## 迭代完成说明

- 将 `.agents/skills/post-edit-maintainability-guard/scripts/maintainability-guard-lint.mjs` 从“每次检查都起 `pnpm exec eslint --stdin` 子进程”改为复用进程内 `ESLint` 实例。
- 将 `inspectPaths` 与 `check-maintainability.mjs` 入口改为异步调用链，以承接 `lintText()` 并保持原有输出与退出码语义。
- 本次目标是降低可维护性守卫的固定启动成本，避免维护性检查本身成为收尾阶段的主要阻力。

## 测试/验证/验收方式

- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw/src/cli/commands/ncp/session-request/session-creation.service.ts --no-fail`
- `/usr/bin/time -lp node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw/src/cli/commands/ncp/session-request/session-creation.service.ts --no-fail`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs .agents/skills/post-edit-maintainability-guard/scripts/maintainability-guard-core.mjs .agents/skills/post-edit-maintainability-guard/scripts/maintainability-guard-lint.mjs`

补充观察：

- 改动前同一单文件场景初测约 `6.10s`。
- 改动后串行 clean run 同一单文件场景约 `1.35s`。
- 当前改动脚本自身的 guard 全量检查约 `1.77s`，输出与 JSON 结构保持正常。

## 发布/部署方式

- 不适用。本次仅调整仓库内本地维护性检查脚本，无独立部署或发布动作。

## 用户/产品视角的验收步骤

1. 在仓库中修改任一受 guard 关注的代码文件。
2. 运行 `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <file>`。
3. 确认输出仍包含 `Inspected files / Errors / Warnings` 与原有 finding 结构。
4. 对比改动前后的体感，确认单文件检查不再出现明显的多秒级启动等待。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。优先命中了最重的固定成本热点，未额外引入新流程或兼容分支。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。删除了子进程调用与 JSON 解析链路，直接复用仓库已经存在的 `ESLint` Node API 能力。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。文件数与目录结构不变，逻辑分支基本不变，但删掉了 CLI 子进程样板代码，总代码量净下降。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。职责仍保持在 lint 层、core 层、CLI 入口三段，没有新增包装层；只是把 lint 实现换成更直接的依赖调用。
- 目录结构与文件组织是否满足当前项目治理要求：是。本次未新增目录平铺或职责错位问题。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立复核，结论为 `通过`，`no maintainability findings`。本次顺手减债：是。主要收益是移除了高固定成本的外部 ESLint 进程启动；保留债务是逐文件 `git show` / `git diff` 仍有进一步批量化空间，但当前已不再是主要瓶颈。
