# 可再生构建产物的 Git 边界

## 背景

`packages/nextclaw/ui-dist` 由 `@nextclaw/ui` 的 `dist` 在 `nextclaw` 构建阶段复制并预压缩生成，但目前仍有 310 个文件被 Git 跟踪。任何本地 UI 构建都会制造大面积哈希漂移，污染并发任务、提交范围和主工作区同步。

`packages/nextclaw-service/build` 同样是构建生成目录，虽然尚未被 Git 跟踪，但缺少明确的忽略规则。

## Owner 与主链路

- UI 业务事实源：`packages/nextclaw-ui` 源码与其构建配置。
- Service 事实源：`packages/nextclaw-service` 源码与构建脚本。
- `nextclaw` 分发包 owner：`packages/nextclaw/scripts/copy-ui-dist.mjs`。
- 发布完整性 owner：`scripts/release/verify-package-release-artifacts.mjs`。

标准链路保持为：

```text
UI / Service 源码
  -> package build
  -> packages/nextclaw-ui/dist 或 packages/nextclaw-service/build
  -> nextclaw build 复制 UI 到 packages/nextclaw/ui-dist
  -> prepack 校验 ui-dist 完整且与 UI dist 一致
  -> NPM tarball 通过 package.json files 携带 ui-dist
```

## 决策

1. 在仓库根 `.gitignore` 中忽略：
   - `/packages/nextclaw-service/build/`
   - `/packages/nextclaw/ui-dist/`
2. 将现有 `packages/nextclaw/ui-dist` 从 Git 索引移除，但不以删除本地生成文件作为迁移前提。
3. 不改变 `nextclaw` 的运行时静态资源查找和 NPM 包内容；发布仍必须先构建 UI，再构建 `nextclaw`，并由现有 prepack 校验阻止缺失或陈旧产物。
4. `clean:generated` 改为删除两个 ignored 生成目录；`check:generated-clean` 改为检查它们没有被 Git 跟踪且确实被忽略，不再把生成目录内容当作源码漂移。

## 取舍

保留 tracked `ui-dist` 可以在源码 checkout 后直接得到一份静态 UI，但代价是每次构建都产生大面积不可审查 diff，并让旧产物可能被误当成事实源。当前构建与发布链已经能够确定性生成并校验该目录，因此不再保留这条平行事实路径。

不采用 `skip-worktree` 或 `.git/info/exclude`：它们只对单个本地 checkout 生效，无法形成仓库级合同，也无法解决发布提交继续携带生成文件的问题。

## 迁移与恢复

- 迁移提交会表现为删除既有 tracked `ui-dist` 文件；构建后目录会在本地重新出现，但不进入 Git 状态。
- 若构建结果异常，直接运行 `pnpm clean:generated` 删除生成目录，再按标准构建链重建；不从 Git 恢复旧 bundle。
- 已发布 NPM 包不受影响，未来包继续由冻结源码生成 `ui-dist` 并通过 tarball 校验。

## 验证标准

- 两个目录均被 `git check-ignore` 命中，且 `git ls-files` 无命中。
- 生成目录存在或内容变化时，`git status` 不出现这些路径。
- `pnpm clean:generated` 可删除两个目录。
- `pnpm check:generated-clean` 可阻止将任一目录重新加入 Git 索引。
- UI 与 `nextclaw` 构建后，发布产物校验仍确认 `ui-dist/index.html`、assets 和预压缩文件完整。

## 非目标

- 不改变 UI、Service 或运行时产品语义。
- 不修改 NPM 发布版本、changeset 或用户 changelog。
- 不清理主工作区中其它任务的源码与文档 WIP。
