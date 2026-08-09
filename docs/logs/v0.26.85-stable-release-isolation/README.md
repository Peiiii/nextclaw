# v0.26.85 稳定发布隔离环境修复

## 迭代完成说明

本批修复稳定 NPM 发布在隔离 worktree 中被主工作区隐式状态掩盖的两个系统性缺口。第一次正式预检在 `npm whoami` 返回 401 后被误判为 token 失效；真实原因是主工作区存在未跟踪的项目级 `.npmrc`，隔离 worktree 只读取了失效的用户级配置。通过同一时刻对比两个目录的身份结果、`.npmrc` 来源和修改时间，确认账号与有效凭据本身没有失效。

认证通过后，严格检查又暴露 `@nextclaw/extension-sdk` 无法解析 `@nextclaw/ncp`：原发布 DAG 只包含 Changesets 发布包，未升版本但被发布包依赖的 workspace 包不参与构建；主工作区残留的 `dist` 会让该缺口平时不可见。

修复后，`release:stable` 在链接 worktree 没有 `.npmrc` 且调用方未显式设置 userconfig 时，自动引用主 worktree 的项目配置。发布检查同时区分“发布包”和“构建前置依赖闭包”：前置包按依赖拓扑只运行 build，不进入 release checkpoint、package count、tag 或 publish。

## 测试/验证/验收方式

- `release-stable.test.mjs` 与新增 `batch-plan.test.mjs` 共 10 条测试通过，覆盖 npm 配置继承优先级、依赖闭包扩展、前置包只 build，以及前置包不读取 checkpoint 缓存。
- 所有触达的 release 脚本通过 `node --check`，`git diff --check` 通过。
- 真实未发布批次的 `NEXTCLAW_RELEASE_CHECK_RESET=1 pnpm release:check:strict` 通过；17 个 workspace 构建前置先于 18 个 Changesets 发布包运行，原 `@nextclaw/ncp` 缺失错误未复现。
- checkpoint `381c5317a7a91425` 精确包含 18 个发布包，没有任何构建前置包。
- 最终 `v0.30.0` 发布仍需在包含本修复的全新隔离 worktree 中完成 28 包严格检查、registry/runtime/真实安装和分支回流验收；完成后更新本记录。

## 发布/部署方式

本提交只先回流稳定发布脚本、测试、设计与 owning skill reference，不发布 NPM、不创建 package tag、不触发 runtime channel。随后从该提交创建新的 release branch/worktree，按完整 `release:stable` 合同发布 `v0.30.0`，不续跑已产生版本文件的失败 worktree。

## 用户/产品视角的验收步骤

1. 主工作区保留本机项目级 `.npmrc`，新建不复制该文件的链接 worktree。
2. 在链接 worktree 执行 stable dry-run 或正式命令，确认日志显示自动使用主 worktree npm config，`npm whoami` 不再假 401。
3. 在没有 workspace `dist` 的新 worktree 中执行严格检查，确认日志先列出并构建 `build prerequisites`。
4. 检查 release checkpoint、tag 和 registry 计划，确认它们只包含真实发布包，不包含未升版本的构建前置。
5. 完成 NPM/runtime/真实安装后验证 `nextclaw@latest`、公开 manifest 和从上一 stable 的升级路径。

## 可维护性总结汇总

本批没有新增发布入口或第二套 package scope。Changesets 仍是发布范围 owner；`batch-plan.mjs` 只扩展验证依赖闭包，`task-runner.mjs` 通过 `checkpointed` 明确区分发布状态和临时构建状态。npm 配置发现留在 `release:stable` 编排边界，不复制凭据，不改变普通 npm/pnpm 命令行为。

规则沉淀更新已有 `npm-release-contract-guard` 的 package/worktree references 和既有 stable 自动化设计，不修改常驻 `AGENTS.md`，不创建新 skill。确定性可验证部分进入脚本和测试，事故背景进入本迭代记录。

## NPM 包发布记录

流程修复本身属于内部发布可靠性改进，不添加用户 changeset。`v0.30.0` 的用户可见 changeset 与结构化发布说明保持原批次；最终 package 数、release commit、tags、runtime workflow、真实安装结果与 X 帖子 URL 将在发布闭环后补充。
