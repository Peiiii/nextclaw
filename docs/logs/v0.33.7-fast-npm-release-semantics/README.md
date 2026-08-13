# v0.33.7 快速 NPM 发布语义与完成点

## 迭代完成说明

- 增加 `/发布NPM`、`/发布NPM测试版`、`/发布NextClaw正式版`、`/发布NextClaw桌面版`、`/发布NextClaw全平台版` 五个中文项目命令，并让清晰自然语言表达继承同一授权边界。
- 增加 `release:npm:stable`、`release:npm:beta`、`release:product:stable` 三个确定性入口，保留既有英文命令作为兼容入口。
- Stable product 流程先完成 registry 验证与精确版本冷安装并报告 `NPM_READY`，再进入 release notes、runtime channel 和旧版本升级；常规正式版明确不包含 desktop。
- Release plan 分开报告版本变化包、实际 NPM 上传包、验证闭包和 validation support package，当前待发布批次 dry-run 为 `24 / 6 / 36 / 30`。
- Validation support build 使用独立 checkpoint section 复用 fingerprint 成功结果，不会被错误纳入 package tag 或 publish 集合。
- `release:publish:validated` 只在 release checkpoint 和 package lifecycle 合同都允许时跳过重复 prepack build；发现自定义 lifecycle 或缺少构建证据时 fail closed。
- Desktop 发布入口先验证对应 `nextclaw@latest` / `nextclaw@beta` identity 已存在，并明确排除 NPM publish。

## 测试/验证/验收方式

- `node --test scripts/release/release-stable.test.mjs scripts/release/check/batch-plan.test.mjs`：16 项通过，覆盖命令解析、完成点、dry-run、恢复参数、支持包缓存和 lifecycle 复用安全门。
- `pnpm release:npm:stable -- --dry-run`：显示 NPM-only 范围、`NPM_READY` 门禁、`24 / 6 / 36 / 30` 计划和 runtime/desktop/materials 排除项。
- `pnpm release:product:stable -- --dry-run`：缺失 release notes 与 surface review 只标记为后续 runtime/product 阻塞，不阻止 NPM package 阶段。
- Targeted ESLint、`git diff --check`、`pnpm check:skill-progressive-loading`、`pnpm check:governance-backlog-ratchet` 与 `pnpm lint:new-code:governance` 通过。
- 49 个公开 workspace package 的 lifecycle 合同审计通过；desktop 已发布 runtime identity 正反路径只读检查通过。
- 未执行真实 registry publish、GitHub workflow、runtime update、desktop release 或旧版本线上升级；这些仍由未来明确发布命令在隔离发布环境中验证。

## 发布/部署方式

本次只创建本地代码提交，不执行 NPM、runtime、desktop、官网、文档站或 X 发布，也不 push。后续用户可用中文命令明确选择最小发布表面；Stable NPM-only 的确定性入口为 `pnpm release:npm:stable`。

## 用户/产品视角的验收步骤

1. 输入“发布 NPM”时，计划只包含 stable NPM、registry、冷安装和 Git 闭合，不出现 runtime、desktop、docs、website 或 X 写入。
2. 输入“发布 NextClaw 正式版”时，计划先显示 `NPM_READY`，再显示 runtime/product 阶段，并明确 `desktop: excluded`。
3. 输入“发布 NextClaw 桌面版”时，入口必须消费已发布 stable identity，不能发布或重发 NPM。
4. 输入“全平台发布”时，先完成常规 stable，再以同一 stable identity 进入 desktop；后序失败不重复前序不可逆阶段。

## 可维护性总结汇总

- 发布对象、授权边界、状态完成点和恢复语义分别由 commands、Delivery、专项 release owner 与确定性脚本拥有，没有新增平行发布 skill。
- 支持包缓存与发布包 checkpoint 分离，减少重复构建但不污染 package release 事实。
- 构建复用采用 allowlist + checkpoint 的 fail-closed 合同，没有用跳过脚本换取未经证明的速度。
- Maintainability guard 最终为 0 error；`release-beta.mjs`、`release-desktop.mjs`、`release-stable.mjs` 和 `release-stable.utils.mjs` 接近文件预算。已把 release scope 与 desktop registry preflight 放入既有 owner；继续拆分当前不会减少真实复杂度，保留为后续有新增职责时的拆分缝。
- 文件和目录组织治理通过；本次没有覆盖并行中的 session token、UI 源码或 `ui-dist` 产物。

## NPM 包发布记录

本次没有发布任何 NPM 包，也没有修改最终用户安装后的产品行为，因此不新增 changeset。改动影响仓库维护者的未来发布流程；下一次真实发布必须由对应中文命令或等价明确授权触发，并按 `NPM_READY` / `NEXTCLAW_STABLE_READY` / `DESKTOP_READY` 完成点记录结果。
