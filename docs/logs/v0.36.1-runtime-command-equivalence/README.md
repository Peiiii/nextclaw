# v0.36.1 Runtime 命令等价性

## 迭代完成说明

- 根因：稳定 npm launcher 注入给 runtime child 的内部环境变量被业务进程和 Agent shell 继续继承；更新后的进程再次执行全局 `nextclaw` 时，launcher 把旧的 child 标记误当成当前调用事实，直接回退到全局包内旧 app，形成“页面/runtime 已更新，命令仍是旧版”的平行业务路径。
- 确认方式：VPS 上运行 bundle 为 `0.35.0`、全局 launcher 为 `0.34.0`，Agent shell 同时存在 `NEXTCLAW_RUNTIME_BUNDLE_CHILD=1`；保留变量时命令返回 `0.34.0`，删除变量后返回 `0.35.0`。
- 根因修复：把 launcher 字段定义成只允许在 app bootstrap 消费一次的 envelope。最小入口先归一化为唯一 distribution context 并立即删除内部环境变量，随后才动态加载 CLI 应用；更新、重启、自启动和 managed service 都读取该 context 并通过稳定 launcher 重入。
- 机制保证：页面更新、Agent shell、新 CLI 与服务生命周期重入收敛到同一 launcher、current pointer 和 bootstrap owner；测试用于证明该机制和 fallback 边界，不再依靠逐个 spawn 点补丁。
- 通用沉淀：设计原则增加 `equivalence-by-construction`；复盘流程增加“最高但仍可执行”的经验抽象层级校准。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/service exec vitest run`：49 个测试文件、186 个测试通过。
- `pnpm --filter nextclaw exec vitest run`：6 个测试文件、18 个测试通过。
- `pnpm --filter @nextclaw/service tsc` 与 `pnpm --filter nextclaw tsc` 通过。
- 变更范围 ESLint、`lint:new-code:governance`、governance backlog ratchet、skill progressive-loading 与 `git diff --check` 通过。
- `pnpm --filter nextclaw... build` 完成 36 个依赖项目构建；构建后的 app、launcher 和旧 launcher envelope 场景均返回当前版本。
- `pnpm dev:verify-update` 真实执行 baseline 启动、自动发现、下载、验签、切换 pointer、重启与重连；PID `10984 -> 18542`，产品版本切换到 `0.36.0`。
- 更新后的真实 Agent shell 执行 `nextclaw --version` 返回 `0.36.0`，四个 launcher 内部变量均为 `unset`，并完成 `REAL-UPDATE-SMOKE-OK` 任务。

## 发布/部署方式

- 使用 NextClaw 稳定 NPM/runtime 正式发布流程发布 patch 版本；release commit 为 `4a877936b`，runtime workflow 为 `31772767810`。
- NPM 冷安装、`0.36.0 -> 0.36.1` 公开 stable channel 分阶段升级、四平台 runtime bundle、GitHub Release、Pages manifest 和中英文版本笔记均已验证。
- 发布后通过 VPS `8.219.57.52` 的产品更新入口应用新 runtime、等待重启，并复验公网、版本、Agent shell 与真实任务。

## 用户/产品视角的验收步骤

1. 在页面发现新版本后执行下载和更新，等待页面自动重连。
2. 确认左上角版本、更新 API 的 product version 与 current runtime 一致。
3. 在更新后的会话中让 Agent 执行 `nextclaw --version`，确认与页面版本一致。
4. 确认 Agent shell 不存在四个 launcher 内部变量，并完成一次真实模型任务。
5. 刷新公网入口，确认页面、会话和服务持续可用。

## 可维护性总结汇总

- 删除了为少数 spawn 点清理变量的专用 helper，改为 bootstrap owner 一次性消费，减少平行修复路径。
- CLI 入口拆成最小 bootstrap 与原应用模块，明确了 ESM 初始化顺序；应用主体仅移动，未新增业务复杂度。
- distribution context 成为运行版本、launcher 版本、launcher 入口和启动来源的唯一事实源，owner 边界更清楚。
- 自动维护性检查 0 error、2 warning；主观复核确认 warning 分别来自必要的同置契约测试和原文件原样移动，没有隐藏复杂度或无收益抽象。
- 文件命名、目录角色、公共 package import 与渐进加载治理均通过。

## NPM 包发布记录

- 需要发布：修复直接影响页面更新后的 CLI、Agent 和服务生命周期行为。
- `nextclaw@0.36.1`：已发布到 `latest`，公开 registry 冷安装与 runtime 更新验证通过。
- `@nextclaw/service@0.3.33`：已发布到 `latest`，registry 精确版本验证通过。
- package tags：`nextclaw@0.36.1`、`@nextclaw/service@0.3.33` 已推送。
