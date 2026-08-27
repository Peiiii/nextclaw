# v0.44.9 Generated Artifact Git Boundary

## 迭代完成说明

本次将 `packages/nextclaw/ui-dist` 与 `packages/nextclaw-service/build` 收敛为可再生、可删除、由 Git 忽略的构建产物目录。

根因是 `ui-dist` 虽然已经由 UI 源码和 `copy-ui-dist.mjs` 确定性生成，仍有 310 个文件被 Git 跟踪；本地 UI 构建会持续产生大面积 hash 漂移，让并行任务、提交范围审计和主线同步反复被生成物污染。通过 `git status`、`git ls-files` 和构建链路确认，问题来自错误的 Git owner，而不是某一次构建异常。

修复直接命中 owner：仓库忽略两个生成目录，现有 `ui-dist` 从 Git 索引移除；源码、构建脚本和发布校验成为唯一事实链。`clean:generated` 同步改为删除 ignored 生成目录，`check:generated-clean` 负责阻止它们重新进入索引。

设计依据见 [`2026-08-28-generated-artifact-git-boundary.design.md`](../../designs/2026-08-28-generated-artifact-git-boundary.design.md)。

## 测试/验证/验收方式

- `node --test scripts/dev/clean-generated-artifacts.test.mjs`：3 项通过，覆盖 ignored/untracked 检查、真实清理和 tracked 回归阻断。
- `pnpm exec eslint scripts/dev/clean-generated-artifacts.mjs scripts/dev/clean-generated-artifacts.test.mjs`：通过。
- `pnpm lint:new-code:governance -- ...`：通过。
- `pnpm -C packages/nextclaw-ui build`：通过。
- `pnpm -C packages/nextclaw build`：通过，重新生成并预压缩 `ui-dist`。
- `pnpm -C packages/nextclaw prepack`：通过，确认 `ui-dist` 与 UI 构建结果一致。
- `pnpm -C packages/nextclaw pack`：通过；tarball 仍包含 312 个 `ui-dist` 条目，包括 `index.html`、JavaScript assets 和 gzip sidecar。
- diff-only maintainability 检查：0 error、0 warning；主观复核无 findings。

## 发布/部署方式

本次只提交 Git 与构建产物边界变更，不发布 NPM、runtime 或 Desktop，不部署网站和服务。后续正式发布继续通过既有 UI build、`nextclaw` build、prepack 和 tarball 校验生成所需产物。

## 用户/产品视角的验收步骤

1. 在源码工作区构建 UI 和 `nextclaw`。
2. 确认 `packages/nextclaw/ui-dist` 已生成且 NextClaw prepack 校验通过。
3. 确认 `git status` 不再出现 `ui-dist` 或 `nextclaw-service/build` 的生成内容。
4. 对 `nextclaw` 执行 pack，确认安装包仍携带完整 UI。

该变化不改变终端用户界面与运行行为；可观察收益是开发与交付工作区不再被可再生 hash 产物污染。

## 可维护性总结汇总

- 删除了 310 个生成文件的 Git owner，减少大规模不可审查 diff。
- 复用现有 `copy-ui-dist` 和发布校验，没有新增发布入口或平行事实源。
- `clean:generated` 从“恢复 Git 快照”收敛为“删除可再生目录”，职责与目录角色一致。
- 新增测试保护 Git 边界；文件组织和 diff-only maintainability 检查通过，无未关闭 finding。

## NPM 包发布记录

不涉及 NPM 包发布。本次不需要 changeset，因为没有改变安装、运行、CLI、UI、Agent 行为或公共 API；现有 `nextclaw` tarball 内容已验证保持完整。
