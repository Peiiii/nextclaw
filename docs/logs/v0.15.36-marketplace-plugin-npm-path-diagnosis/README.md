# v0.15.36-marketplace-plugin-npm-path-diagnosis

## 迭代完成说明（改了什么）

- 排查并收敛插件市场安装 Codex 插件时报 `Error: npm pack failed: Error: spawn npm ENOENT` 的根因：
  - 插件安装链路在 [`packages/nextclaw-openclaw-compat/src/plugins/install.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-openclaw-compat/src/plugins/install.ts) 中会先执行 `npm pack`，随后在有依赖时继续执行 `npm install --ignore-scripts`，因此宿主进程必须能直接找到本机 `npm`。
  - 进一步讨论后确认，根本方向不该是继续扩 PATH 猜测或环境兜底，而是把 npm 来源收敛到“当前正在运行 NextClaw 的这份 Node”。
- 最终实现改为 runtime-bound npm：
  - 新增 [`packages/nextclaw-openclaw-compat/src/plugins/runtime-npm.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-openclaw-compat/src/plugins/runtime-npm.ts)，专门负责解析当前 `process.execPath` 对应的 `npm-cli.js`，并通过同一份 Node 执行 `npm pack` / `npm install`。
  - [`packages/nextclaw-openclaw-compat/src/plugins/install.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-openclaw-compat/src/plugins/install.ts) 不再 `spawn("npm")`，也不再依赖 PATH 猜测。
  - 运行 npm 命令时仅保留最小必要环境处理：清理 `NODE_OPTIONS` 中不适合外部命令的开发态条件，并继续保留 `NPM_CONFIG_IGNORE_SCRIPTS=true`。
- 失败信息改为尽量不丢失原始内容：
  - `npm pack` 与 `npm install` 失败时，不再只取 `stderr` 或 `stdout` 其中一侧。
  - 现在会把子进程产生的原始输出流尽量完整保留下来并向上返回，避免定位问题时损失关键信息。
- 新增定向测试：
  - [`packages/nextclaw-openclaw-compat/src/plugins/install.test.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-openclaw-compat/src/plugins/install.test.ts)
  - 该测试覆盖两件事：安装链路确实使用 `process.execPath` 绑定的 npm CLI；失败时 stdout/stderr 都不会被裁掉。

## 测试 / 验证 / 验收方式

- `pnpm --filter @nextclaw/core exec vitest run src/agent/tools/shell.test.ts`
- `pnpm --filter @nextclaw/core exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter @nextclaw/openclaw-compat exec vitest run src/plugins/install.test.ts`
- `pnpm --filter @nextclaw/openclaw-compat exec tsc -p tsconfig.json --noEmit`
- `pnpm lint:maintainability:guard`

结果：

- 上述命令均通过。
- `lint:maintainability:guard` 无 error；仍有仓库既有的目录预算 / 超长文件 warning，但本次把 [`packages/nextclaw-openclaw-compat/src/plugins/install.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-openclaw-compat/src/plugins/install.ts) 从 577 行压到 555 行，没有继续放大原文件。

## 发布 / 部署方式

- 本次未执行发布或部署。
- 不涉及后端、数据库或远程 migration。
- 后续随下一次 CLI / desktop / server 正常发布批次带出即可。

## 用户 / 产品视角的验收步骤

1. 在任意通过 Node 启动 NextClaw 的场景下打开插件市场并安装 Codex 插件。
2. 确认安装链路不再依赖 PATH 中某个偶然可见的 `npm`，而是稳定使用当前运行时对应的 npm。
3. 若安装失败，确认返回信息中同时保留原始 stdout/stderr 关键内容，方便用户直接反馈给开发者定位。
4. 若当前运行时本身不带可用 npm，确认错误能够直接暴露真实失败，而不是被 PATH 猜测或额外兜底掩盖。

## 可维护性总结汇总

- 可维护性复核结论：保留债务经说明接受
- 本次顺手减债：是
- no maintainability findings
- 可维护性总结：这次属于非新增用户能力的稳定性修正，最终没有继续往运行时塞 PATH 猜测和定制报错，而是把行为来源收敛成单一路径：当前运行时绑定的 npm。为避免在超长 `install.ts` 中继续堆逻辑，本次把 runtime npm 执行职责单独挪到 [`packages/nextclaw-openclaw-compat/src/plugins/runtime-npm.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-openclaw-compat/src/plugins/runtime-npm.ts)，同时把 `install.ts` 压回去；仍保留的债务是 `plugins/` 目录继续平铺，以及 `install.ts` 虽缩短但仍超预算。
- 本次是否已尽最大努力优化可维护性：是。在不扩大协议和 UI 能力面的前提下，已经把实现收敛到“单一 npm 来源 + 原始错误透传 + 单一职责 helper”，没有继续保留此前那种环境兜底方向。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。删除了 PATH 扩展和友好文案包装思路，改为更少猜测、更少环境分支的实现。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。文件数因新增一个定向 helper 与一个定向测试而增加，这是为了把超长文件中的新职责拆出去并覆盖真实回归风险的最小必要增长；同时主流程文件 `install.ts` 净减 22 行，复杂度比“直接堆在 install.ts 里”更低。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。`runtime-npm.ts` 只负责“如何运行当前 runtime 的 npm”，`install.ts` 回到“如何安装插件”；没有新增多层 adapter，也没有把 incident-specific 逻辑固化进 shipped runtime。
- 目录结构与文件组织是否满足当前项目治理要求：未完全满足。`packages/nextclaw-openclaw-compat/src/plugins/` 目录继续平铺，本次为了降低 `install.ts` 风险接受了新增一个 helper 文件的最小必要增长；下一步整理入口仍是把安装、加载、卸载等职责进一步按域拆分。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。本节结论基于守卫之后的独立复核，明确判断了为何这次新增文件仍属最小必要，以及哪些债务被保留接受。
