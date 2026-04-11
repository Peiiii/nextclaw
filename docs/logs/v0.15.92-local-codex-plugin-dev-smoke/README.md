# v0.15.92-local-codex-plugin-dev-smoke

## 迭代完成说明

- 新增仓库级本地验证入口 `pnpm smoke:codex-plugin:local`，用于直接验证当前仓库里的 first-party Codex runtime 插件源码。
- 同批次继续把这条能力推广成统一底座：新增 `pnpm dev:plugin:local -- --plugin-path <path>`，把“本地插件 link + source 选择 + 本地服务启动 + 可选前端代理”收成任意插件都能复用的一条开发态入口。
- 这条命令会自动完成：
  - 创建隔离 `NEXTCLAW_HOME`
  - 复制现有 `~/.nextclaw/config.json`
  - 本地 link `packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk`
  - 强制 `plugins.entries.nextclaw-ncp-runtime-plugin-codex-sdk.source=development`
  - 启动源码态 NextClaw 服务
  - 调用既有 `smoke:ncp-chat` 跑真实 `session_type=codex` 回复校验
- 新增本地 skill [`testing-local-codex-plugin`](../../../.agents/skills/testing-local-codex-plugin/SKILL.md)，让后续 AI 在“我要测本地 Codex 插件、不要重新发布”的场景下优先调用这条仓库命令，而不是继续手工拼步骤。
- 新增通用 skill [`testing-local-plugin-development-source`](../../../.agents/skills/testing-local-plugin-development-source/SKILL.md)，让后续 AI 在“我要测其它本地插件、尤其是前端联调场景”时，优先使用统一底座命令，而不是为每个插件重新发明一套步骤。

## 测试/验证/验收方式

- 命令帮助：
  - `node scripts/local-codex-plugin-smoke.mjs --help`
- 结果：通过。
- 通用命令帮助：
  - `node scripts/local-plugin-dev-server.mjs --help`
- 结果：通过。
- 真实本地冒烟：
  - `pnpm smoke:codex-plugin:local`
  - 本次实际结果：
    - `Result: PASS`
    - `Session Type: codex`
    - `Model: dashscope/qwen3.6-plus`
    - `Base URL: http://127.0.0.1:18834`
- 通用本地插件开发态入口：
  - `pnpm dev:plugin:local -- --plugin-path ./packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk --session-type codex --frontend --no-keep-running`
  - 结果：通过。说明统一底座命令已能拉起本地源码插件后端，并可按需挂前端代理。
  - 本次实际输出：
    - `plugin source mode: development`
    - `backend URL: http://127.0.0.1:18834`
    - `frontend URL: http://127.0.0.1:5175`
- 本次收尾另执行：
  - `pnpm lint:maintainability:guard`
  - 结果：失败，但失败点来自仓库中并行改动的既有问题，不是本次新增的本地 Codex 插件 smoke 入口：
    - `apps/desktop/scripts` 目录预算超限
    - `packages/nextclaw-core/src/providers/openai_provider.ts` 多个函数预算/复杂度问题
  - 本次新增脚本 `scripts/local-codex-plugin-smoke.mjs` 已不再触发守卫级 error，仅保留“接近文件预算上限”的 warning。

## 发布/部署方式

- 不需要发布新版 npm 包。
- 本地验证直接在仓库根目录执行 `pnpm smoke:codex-plugin:local` 即可。
- 若后续要让仓库外部安装态也获得同样入口，再考虑单独发布 CLI 版本；本次目标就是避免“改完插件还要先发版才能测”。

## 用户/产品视角的验收步骤

1. 在当前仓库里修改 Codex 插件源码。
2. 在仓库根目录执行 `pnpm smoke:codex-plugin:local`。
3. 等待命令自动完成本地 link、development source 切换、服务启动与真实回复 smoke。
4. 确认输出包含 `Result: PASS`。
5. 如需继续在 UI 手动验证，直接打开命令打印的本地 URL。
6. 验证完成后执行命令打印的 `kill <pid>` 清理本地实例。
7. 若改的是其它插件，则改用 `pnpm dev:plugin:local -- --plugin-path ./packages/extensions/<plugin-dir> --frontend`。
8. 如果插件属于 agent-runtime，再加上 `--session-type <type>`，让命令等待对应 runtime ready。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。没有再把“本地测 Codex 插件”的知识散落到口头说明和临时命令里，而是收敛成一条仓库命令和一个 skill。
- 同批次进一步推进：没有把“其它插件”继续留在口头说明里，而是把统一底座单独沉淀成 `dev:plugin:local` 和通用 skill，避免 Codex 再次成为一个只对单插件成立的特例流程。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。复用了已有 `smoke:ncp-chat`，没有再造第二套请求拼装与 SSE 解析逻辑。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：本次新增了一个脚本、一个 skill 和一份迭代记录，总代码/文件数净增长。其中代码改动为 `476` 行新增、`0` 行删除（`package.json` `+2`，`scripts/local-codex-plugin-smoke.mjs` `+474`）；非测试代码净增长同为 `+476`。这部分增长是为了把原本高频、手工、易错的本地验证流程收成单点入口，并复用现有 smoke 栈而不是再扩散更多临时命令。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。脚本只负责编排本地 smoke 所需动作，真实聊天校验继续复用 `scripts/chat-capability-smoke.mjs`；skill 只负责编排触发条件和标准命令，不承载实现细节。
- 目录结构与文件组织是否满足当前项目治理要求：满足。仓库级命令放在 `scripts/`，AI 行为沉淀放在 `.agents/skills/`，没有把本地调试逻辑塞进业务包源码。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。已基于实现后的独立复核填写本节。
