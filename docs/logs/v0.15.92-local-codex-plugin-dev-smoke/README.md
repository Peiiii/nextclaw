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
- 同批次续改修复了 `pnpm dev:plugin:local` 的一个误判根因：此前脚本只要探测到目标 URL 健康就会判定成功，因此当旧的本地服务已经占着同一端口、新启动的服务其实因为 `EADDRINUSE` 退出时，命令仍会错误返回成功，导致前端联调实际连到旧 backend，看起来就像“本地未发布插件没生效”。
- 现在本地开发入口会先等待“本次刚拉起的 detached 进程”在自己的日志里真正达到 ready，再去做 URL 健康检查；如果子进程提前退出，就直接失败并带出日志尾部，而不是误把别的存活服务当成本次成功实例。
- 同批次再次续改，把“只适合专门本地调试命令”的能力提升成 `pnpm dev start` 可复用的通用机制：现在可以通过重复传入 `--plugin-override <pluginId>=<path>[#production|#development]`，按插件粒度覆盖默认来源，并且支持同时指定多个插件。
- 这套 override 默认走本地插件目录的 `production` 入口，也就是刚 build 出来的 `dist`，只有显式写 `#development` 时才切到源码入口；其它未指定插件继续保持默认来源。
- override 只对当前 `pnpm dev start` 进程生效，不修改 `~/.nextclaw/config.json`。为了避免“我明明只想替换一份本地插件，却同时加载了安装态旧副本”的混乱，当前实现会把被覆盖插件的旧安装根目录一并排除。
- 本轮方案先沉淀在 [2026-04-11-dev-start-plugin-override-plan.md](../../plans/2026-04-11-dev-start-plugin-override-plan.md)。
- 同批次继续修掉了一个更隐蔽的 Codex 图片问题：源码里的 `nextclaw-ncp-runtime-plugin-codex-sdk` 已经会把 `resolveAssetContentPath` 传进 Codex input builder，但仓库里提交的 `dist/index.js` 还是旧构建，漏掉了这条参数，导致 `pnpm dev start --plugin-override ...` 默认走 `production` 时，图片 attachment 会退化成纯文本提示，出现“知道有图片附件，但看不到实际画面内容”的假象。
- 这次直接重建了插件的 production `dist`，让 production 覆盖模式和源码行为重新一致；同时新增一个专门针对 production 构建产物的回归测试，防止以后再次出现“源码已修、dist 仍旧坏”的发布前漂移。
- 同批次进一步把这类问题做成通用 DX 方案：新增 `pnpm dev:start:plugins -- --plugin <ref>`，让开发者可以直接用 first-party 插件名、插件 id 或唯一后缀来选择本地插件，不用手写完整 `--plugin-override`。
- 这条包装命令默认继续走 `production`，但会先检查目标插件的 production `dist` 是否陈旧；若发现源码比 `dist` 新，则默认自动执行对应插件的 `build`，再启动 `pnpm dev start`。如果显式走 `--development`，则直接切源码，不做 production 构建检查。
- 底层 `scripts/dev-runner.mjs` 也同步接入了同一套 stale production build 校验，因此即使不走 `pnpm dev:start:plugins`，直接手写 `pnpm dev start --plugin-override ...` 也不会再静默吃到陈旧构建。

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
- 本次续改定向验证：
  - `node --check scripts/local-plugin-dev-server.mjs`
  - 结果：通过。
  - `pnpm dev:plugin:local -- --plugin-path ./packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk --session-type codex --frontend --ui-port 18834 --frontend-port 5179 --json`
  - 结果：按预期失败，输出 `local service exited before staying ready`，并带出 `EADDRINUSE: 0.0.0.0:18834` 日志，不再误报成功。
  - `pnpm dev:plugin:local -- --plugin-path ./packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk --session-type codex --frontend --ui-port 18952 --frontend-port 5180 --no-keep-running --json`
  - 结果：通过，说明修复后“冲突端口 fail-fast / 干净端口正常拉起”两条路径都符合预期。
- 本轮 `dev start` 多插件 override 定向验证：
  - `node --check scripts/dev-runner.mjs`
  - 结果：通过。
  - `pnpm -C packages/nextclaw exec vitest run src/cli/commands/plugin/development-source/dev-plugin-overrides.test.ts src/cli/commands/plugin/dev-first-party-plugin-load-paths.test.ts`
  - 结果：通过，10/10 通过。
  - `node scripts/dev-runner.mjs start --plugin-override broken`
  - 结果：按预期立即失败，提示 `Expected <pluginId>=<path>[#production|#development]`。
  - `node scripts/dev-runner.mjs start --plugin-override nextclaw-ncp-runtime-plugin-codex-sdk=./packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk`
  - 结果：按预期立即失败，提示 override plugin id 与本地 manifest id 不匹配。
  - `NEXTCLAW_DEV_BACKEND_PORT=18964 NEXTCLAW_DEV_FRONTEND_PORT=5186 node scripts/dev-runner.mjs start --plugin-override nextclaw-ncp-runtime-plugin-codex-sdk=./packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk`
  - 结果：通过，主开发入口能正常启动，并打印当前进程生效的 plugin override。
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk build`
  - 结果：通过，重新生成 production `dist` 后，`dist/index.js` 已重新包含 `resolveAssetContentPath: runtimeParams.resolveAssetContentPath`，不再丢失图片本地路径解析。
  - `pnpm -C packages/nextclaw exec vitest run src/cli/commands/compat/codex-runtime-plugin-production-build.test.ts src/cli/commands/compat/codex-input-builder.test.ts`
  - 结果：通过，4/4 通过；其中新增的 production-build 回归测试明确覆盖了“production `dist` 仍能把 image asset 变成 `local_image` 输入”。
  - `node --check scripts/dev-plugin-overrides-support.mjs`
  - 结果：通过。
  - `node --check scripts/dev-start-plugins.mjs`
  - 结果：通过。
  - `node --test scripts/dev-plugin-overrides-support.test.mjs`
  - 结果：通过，4/4 通过；覆盖了 first-party 插件 ref 解析与 stale production build 判定。
  - `node scripts/dev-start-plugins.mjs --plugin codex-sdk --dry-run`
  - 结果：通过；唯一后缀 `codex-sdk` 能正确解析到 `nextclaw-ncp-runtime-plugin-codex-sdk`，并打印最终转发给 `dev-runner` 的命令。
  - `node scripts/dev-start-plugins.mjs --plugin nextclaw-ncp-runtime-plugin-codex-sdk --development --dry-run`
  - 结果：通过；开发态模式会正确转发成 `#development` override。
  - `pnpm -C packages/nextclaw tsc --pretty false`
  - 结果：失败，但失败点来自既有的 `packages/nextclaw-server/src/ui/ui-routes/marketplace/installed.ts` 类型问题，与本轮 override 改动无关。
- 本次收尾另执行：
  - `pnpm lint:maintainability:guard`
  - 结果：本轮因工作树里并行改动的无关新文件阻塞，失败点是 `apps/maintainability-console/scripts/dev.mjs` 与 `apps/maintainability-console/shared/maintainability-types.ts` 的命名治理，不是本次新增的 `dev:start:plugins` / stale build 逻辑。与本轮直接相关的新脚本和新测试已通过定向语法检查、node:test 与 dry-run 验证。

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
9. 若目标端口上已经有旧实例，占用冲突时命令应直接失败并提示日志，而不是继续打开一个其实连着旧 backend 的前端页面。
10. 如果你想继续用主开发入口，而不是专门的本地调试命令，可以直接运行：
    `pnpm dev start --plugin-override <pluginId>=<local-plugin-path>`
11. 如果只想吃本地最新构建产物，保持默认 `production` 即可；如果确实要切源码，再显式写：
    `--plugin-override <pluginId>=<local-plugin-path>#development`
12. 如果同时调多个插件，就重复传多个 `--plugin-override`，未指定插件继续保持默认来源。
13. 如果你更想要开发者友好的包装命令，可以直接运行：
    `pnpm dev:start:plugins -- --plugin <plugin-ref>`
14. `pnpm dev:start:plugins` 默认会对显式选择的 first-party 插件做 production 构建新鲜度检查，必要时自动 build；如果你想直接吃源码，可加 `--development`。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。没有再把“本地测 Codex 插件”的知识散落到口头说明和临时命令里，而是收敛成一条仓库命令和一个 skill。
- 同批次进一步推进：没有把“其它插件”继续留在口头说明里，而是把统一底座单独沉淀成 `dev:plugin:local` 和通用 skill，避免 Codex 再次成为一个只对单插件成立的特例流程。
- 同批次这次续改进一步把“成功”定义从“端口上有服务”收紧为“我刚拉起的那个进程已 ready 且仍存活”，避免调试入口对环境残留做隐式乐观假设。
- 本轮再继续把“覆盖本地插件”的能力从专门脚本推广到主开发入口，但仍然坚持插件粒度和显式参数，不做“所有插件一起自动本地化”的隐式魔法。
- 本轮也补上了 production 构建产物与源码之间的对齐缺口，避免用户默认用 `production` 覆盖时再次踩到“源码支持图片、dist 版本却把图片降级成附件提示”的隐性漂移。
- 这次再往前推一步，把“插件路径解析 + stale build 防呆 + 启动命令拼装”统一包进了 `dev:start:plugins`，让高频本地插件开发不再依赖人工记忆和手动拼命令，同时底层仍保留显式、可预测的 `--plugin-override` 原语。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。复用了已有 `smoke:ncp-chat`，没有再造第二套请求拼装与 SSE 解析逻辑。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：本次续改新增 `61` 行脚本代码、未新增文件。增长集中在 `scripts/local-plugin-dev-server.mjs` 的 ready 守卫，没有再扩散到运行时或插件主链路；这是为了把“误连旧服务”这类高成本假成功直接阻断，属于最小必要增长。
- 本轮 `dev start` override 子集相对当前工作树为：非测试代码新增 `173` 行、删除 `175` 行，净减 `-2`；测试新增 `1` 个定向测试文件，方案新增 `1` 份计划文档。增量主要集中在 `scripts/dev-runner.mjs` 与一个通用 override helper，用来换掉散落在入口处的临时特判。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。脚本只负责编排本地 smoke 所需动作，真实聊天校验继续复用 `scripts/chat-capability-smoke.mjs`；skill 只负责编排触发条件和标准命令，不承载实现细节。
- 目录结构与文件组织是否满足当前项目治理要求：满足。仓库级命令放在 `scripts/`，AI 行为沉淀放在 `.agents/skills/`，没有把本地调试逻辑塞进业务包源码。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。已基于实现后的独立复核填写本节。

可维护性复核结论：通过

本次顺手减债：是

长期目标对齐 / 可维护性推进：
- 这次续改顺着“统一入口、统一体验、可预测行为”的长期方向推进了一步。本地插件调试入口不再因为环境里残留旧服务而制造假成功，用户更容易确认自己看到的就是当前源码实例。
- 这次没有去插件图片链路里再补一层兜底或更多日志噪音，而是优先修掉调试入口本身的误判根因，让后续图片问题能在正确实例上继续排查。
- 本轮继续往前推了一步：用户不需要为了只调一个本地插件离开主开发入口，也不需要把所有插件一起切到本地；现在可以在 `pnpm dev start` 里按插件显式覆盖，统一入口和可预测性都更强。

代码增减报告：
- 新增：61 行
- 删除：0 行
- 净增：+61 行

非测试代码增减报告：
- 新增：61 行
- 删除：0 行
- 净增：+61 行

可维护性总结：
- no maintainability findings
- 这次续改没有把 Codex 再做成特例，而是收成“主开发入口 + 多插件显式 override + 默认 production / 可选 development”的通用机制。剩余要关注的点是 `scripts/dev-runner.mjs` 已接近预算上限，后续若再扩 dev 启动参数，优先继续拆到专门 helper，而不是再往入口文件堆逻辑。
