## 迭代完成说明

本次新增内置 skill `panel-app-react-vite-creator`，用于指导 AI 使用 `pnpm + Vite + React + TypeScript + Tailwind CSS` 开发工程化 Panel App，并将 build 后的静态产物交付为 `~/.nextclaw/workspace/panels/<app-id>.panel/`。

同步更新 `panel-app-creator` 与 `nextclaw-app-creator`：当用户要求现代前端技术栈、React/Vite/Tailwind、工程化源码或可构建 Panel App 时，必须路由读取新 skill；`panel-app-creator` 仍负责 manifest、bridge、Client SDK、Service Actions、窄侧栏体验和 `nextclaw app check`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/core test -- src/features/agent/features/tests/skills.test.ts`：通过，9 个测试通过，覆盖新内置 skill 可加载、React/Vite/Tailwind 关键合同、`panel-app-creator` 对新 skill 的引用。
- `pnpm --filter @nextclaw/core tsc`：通过。

## 发布/部署方式

不涉及运行时部署。涉及 `@nextclaw/core` 内置 skill 内容变化，已新增 changeset，待后续统一 beta 发布流程发布。

## 用户/产品视角的验收步骤

用户要求“用 React/Vite/Tailwind 做 Panel App”或“用现代前端技术栈开发 Panel App”时，AI 应读取 `panel-app-react-vite-creator`，按 pnpm/Vite 工程开发，构建后交付静态 `.panel` 目录，并继续使用 `panel-app-creator` 完成 NextClaw 能力声明与验收。

## 可维护性总结汇总

本次没有把工程化前端规则塞回常驻 `AGENTS.md`，而是放入场景内置 skill，并由现有 Panel App skill 路由引用。职责边界清晰：新 skill 管源码工程和 build 产物，旧 Panel App skill 继续管运行时合同和授权能力。

## NPM 包发布记录

涉及 `@nextclaw/core` 内置 skill 内容变化，已新增 patch changeset。状态：待后续统一 beta 发布流程发布。
