---
name: npm-beta-release
description: 当用户要求“发布 beta”“统一 beta 发版”“发一个新的 NPM beta 版本”“一键 beta release”或希望直接复用 NextClaw 的 beta 发布闭环时使用。适用于 nextclaw 及其相关 workspace 包的 beta 发布，也适用于需要同时闭合 npm registry 与 NPM runtime update channel 的场景。
---

# NPM Beta Release

## 目标

把 NextClaw 的 beta 发布收敛成一个可重复、可验证、可直接复用的闭环入口，而不是让发布者再手工记住一串零散步骤。

默认入口：

```bash
pnpm release:beta
```

## 何时使用

- 用户说“发布 beta”
- 用户说“发一个新的 NPM beta 版本”
- 用户说“统一 beta 发版”
- 用户说“有没有一键 beta release”
- 用户说“后面我想直接复用这个流程”

## 主入口契约

优先使用仓库根的一键入口：

```bash
pnpm release:beta
```

它默认完成：

1. `pnpm release:auto`
2. 如有 version / changelog 变更，自动创建 release commit
3. 推送当前分支与本地 package tags
4. 若当前 batch 包含 `nextclaw`，自动触发 `npm-runtime-update-release` 的 `beta` channel
5. 等待 workflow 成功，并验证：
   - GitHub release assets
   - GitHub Pages 公网 beta manifest

## 常用参数

```bash
pnpm release:beta -- --dry-run
pnpm release:beta -- --skip-runtime-channel
pnpm release:beta -- --minimum-launcher-version-override 0.18.12-beta.3
```

规则：

- `--minimum-launcher-version-override` 只允许 recovery publish 场景使用。
- 没有特殊理由，不要跳过 runtime channel。
- 没有特殊理由，不要抬高 `minimumLauncherVersion`。

## 运行前检查

1. 工作区必须干净。
2. `.changeset/pre.json` 必须处于 `mode=pre` 且 `tag=beta`。
3. 本机必须有：
   - `pnpm`
   - `gh`
   - `curl`
4. 如 batch 包含 `nextclaw`，继续遵守 `npm-release-contract-guard`：
   - `resources/update-bundle-public.pem` 必须进入包内
   - runtime update workflow 必须真正成功，不能只停在 dispatch

## 完成判定

只有同时满足下面条件，才算 beta 发布真正完成：

1. npm registry 上能看到本次 beta 版本
2. 本地 release commit 与 tags 已推送
3. 若 batch 包含 `nextclaw`：
   - `npm-runtime-update-release` workflow 成功
   - 对应 GitHub release 挂上四个平台 runtime zip
   - 公网 `beta` manifest 的 `latestVersion` 指向这次版本

## 回答模板

向用户汇报时，至少给出：

- 入口命令：`pnpm release:beta`
- 本次发布 batch
- release commit
- 是否触发 runtime channel
- workflow URL
- public manifest 校验结果

## 关系说明

- 这个 skill 是发布 owner。
- NPM 发布合同细则继续复用 `npm-release-contract-guard`。
- 如果只是解释发布机制，可说明入口和边界，不必真的执行发布。
