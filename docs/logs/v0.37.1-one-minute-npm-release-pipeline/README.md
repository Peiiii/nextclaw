# v0.37.1-one-minute-npm-release-pipeline

## 迭代完成说明

- 将“发布 NPM”固定为只发布 NextClaw 的 NPM package closure，不隐式发布 runtime channel、桌面端、网站、文档或社交材料。
- 根因调查确认，旧流程的主要耗时不在单次 `npm publish`，而在发布窗口内重复构建/检查、22 个包串行上传、发布后重复 registry 校验，以及 Git 收尾与冷安装串行执行。此前一次完整发布耗时 `378.63s`，其中 package 上传跨度约 `55.4s`、发布后阶段约 `118.9s`。
- 新主链路把可提前完成的版本计算、build、tsc、lint、依赖审计和 pack 前移到与精确 commit 绑定的不可变 prepared artifact；正式窗口只允许消费该 artifact，不允许静默退回慢速准备。
- 22 个包采用有界并发预检、上传和逐包 version/integrity/latest registry 校验；Git 原子推送闭环与空缓存公网精确 tarball/payload 审计并行执行。正式计时覆盖 artifact 定位/下载、发布、校验、payload 审计和本地/远程 `master` 同步。
- `master` push 触发 `npm-release-prepare` 工作流自动生成精确 SHA artifact。该工作流不持有 NPM 发布权限；真正发布仍由用户明确说“发布 NPM”后启动，并复用当前 NPM 登录状态。
- 认证配置不再依赖模型或 shell 偶然继承：正式入口按“显式 `NPM_CONFIG_USERCONFIG` → 当前 worktree `./.npmrc` → 主 worktree `./.npmrc`”解析唯一配置，打印绝对路径，并用同一配置执行 `npm whoami`；找不到项目配置时拒绝回退 `~/.npmrc`。publish 与 dist-tag/package settings 强认证分别判定。
- 恢复流程按 registry 已存在的精确版本继续，禁止重复发布已成功的包；Git tag 保持不可变，本地目标分支、远程目标分支和发布分支最终必须指向同一个 release commit。

### 2026-08-15 默认工作区回流修正

`nextclaw@0.38.0` 正式发布暴露了现有 Git 闭环的隐藏副作用：release worktree 发现 `master` 已在默认工作区检出时，要求先把默认工作区切到保护分支，发布器才能强制移动本地 `master` ref。该做法虽然保护了 WIP，却改变了默认工作区的常驻分支，并把恢复依赖留给人工收尾。

修正继续沿用同一套 isolated-worktree 发布方法，不新增入口：release branch 仍在隔离 worktree 中生成 release commit、tag 和远端闭环；本地 `master` 已在默认工作区检出时，Git closure 改为直接在该工作区执行 `merge --ff-only <release-commit>`。默认工作区全程保持 `master`，不重置、不 stash，非重叠 WIP 原样保留；存在重叠而无法 fast-forward 时安全停止并保留 release branch。

## 测试/验证/验收方式

- 发布合同与恢复语义：32 项 Node 测试全部通过，覆盖 prepared artifact 导入、精确 commit 工作流选择、部分发布恢复、逐包 latest/integrity 校验、原子 Git 闭环、60 秒预算和命令语义。
- 默认工作区回流回归：真实创建检出 `master` 的默认工作区、独立 release worktree 和非重叠未提交 WIP；Git closure 后默认工作区仍为 `master`，WIP 内容与状态不变，本地/远端目标和 release branch 指向同一提交。
- 定向静态检查：相关 release scripts 的 ESLint、Node syntax check、`git diff --check`、workflow YAML 解析与格式检查通过。
- package 类型与构建：NextClaw package closure build 通过，`packages/nextclaw` 的 `tsc` 通过。
- 治理检查：skill progressive loading、governance backlog ratchet、new-code governance 和 maintainability guard 通过。
- 在最新 `origin/master`（`2d9e1618518c`）上使用无 npmjs uplink 的隔离 registry 重验：22 个目标包全部真实走 NPM publish 协议，package 预检 `2.452s`、上传 `8.118s`、逐包 identity 校验 `2.657s`；包含空缓存公网精确 payload 审计和本地/远程 Git 闭环的总耗时为 `40.888s`，低于 `60s` 硬门槛。
- 正式入口在 prepared artifact 条件不满足时于 `0.43s` 的 preflight 阶段失败，先打印实际项目 `.npmrc` 绝对路径，未触达 NPM 发布，不会把慢准备偷偷搬回正式窗口。
- 认证回归证据：项目根 `./.npmrc` 下 `npm whoami` 返回 `peiiii`，`@nextclaw/app-runtime` collaborator 权限为 `read-write`；默认 `~/.npmrc` 的 401 被明确归类为无关配置源，不能再生成“项目没有发布权限”的结论。

## 发布/部署方式

- 这是内部发布基础设施改造，不添加用户可见 changeset，也不自动发布新版本。
- 下一次用户授权的 npmjs stable 发布需要保留阶段计时，并作为公网 registry 延迟的最终验收证据；若总计时超过 `60s`，命令必须失败并报告具体阶段，不得声称达到 `NPM_READY`。
- NPM 发布完成后，合同同时要求本地 `master`、`origin/master`、发布分支和 release tags 闭环；只把 release commit 推回远程而不更新本地 `master` 不算完成。
- 本批只提交发布工具、规则、测试、设计与迭代证据；不推送远程，不发布新的 NPM/runtime/desktop 版本。

## 用户/产品视角的验收步骤

1. 用户仍只需表达“发布 NPM”或执行 `/发布NPM`，不需要学习 prepare 子命令。
2. release-bearing `master` commit 的 prepare workflow 成功后，正式命令必须打印项目 `.npmrc` 绝对路径与 NPM 身份。
3. 正式窗口应显示 artifact、package 与 Git/payload join 的阶段计时；总耗时小于 60 秒时才输出 `NPM_READY`。
4. 完成后确认每个包的精确版本、integrity、`latest`，以及本地 `master === origin/master === release branch`。

## 可维护性总结汇总

- 已尽最大努力把慢准备、并发 publisher、artifact import/export、Git 闭环和发布表面拆到各自单一 owner；旧 `release-stable.mjs` 从 500 行降至 473 行，`release-stable.utils.mjs` 从 496 行降至 467 行。
- 删除正式窗口中的重复 build/pack 和串行 registry 查询，没有新增慢路径 fallback、平行 release plan 或后台假完成分支。
- diff-only maintainability guard 为 0 error、4 个接近预算 warning；两个既有大文件均净减，新 benchmark 与 prepared publisher 仍低于 500 行预算。主观 Review 无阻塞 finding。
- new-code governance、目录/文件命名、skill progressive loading 和 backlog ratchet 均通过；新增文件位于既有 `scripts/release`、`.github/workflows`、`docs/designs` 与 `docs/logs` owner 下。

## NPM 包发布记录

- 本批不发布新的 NPM 包；公开 `nextclaw@latest` 仍为 `0.35.0`，隔离演练没有改变正式版本。
- 下一次用户授权的 stable 批次将统一通过 `pnpm release:npm:stable` 发布，并保存公网 `<60s` 的最终 SLA 证据。
- 早期演练创建的 `codex-speed-20260814-51555` 临时 tag 仍存在于 22 个包并指向旧批次；项目凭证可发布且为 `read-write`，但 NPM 对 dist-tag DELETE 单独返回 package-settings `403`。这项残余清理需要一次 NPM package-settings 强认证，不能被描述为“没有发布权限”，也不能用不安全的元数据覆盖绕过。
