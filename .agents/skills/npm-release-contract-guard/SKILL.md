---
name: npm-release-contract-guard
description: 当发布 NextClaw NPM packages 或 NPM runtime update channel 时使用；先选择 package 发布、runtime channel、published install 验证或分支回流一个阶段并读取对应 reference。
---

# NPM Release Contract Guard

## 阶段路由

- 版本范围、changeset、依赖闭包、registry 发布：读取 [Package 发布](references/package-release.md)。
- beta/stable runtime bundle、manifest、Pages：读取 [Runtime channel](references/runtime-channel.md)。
- 验证真实 `nextclaw@beta/latest` 安装与 update：读取 [Published install](references/published-install-validation.md)。
- 隔离 worktree、release branch 与 master 回流：读取 [分支闭合](references/branch-closure.md)。

一次只读取当前阶段。Desktop installer/DMG 由 desktop release skill 拥有。

## 永久合同

- 使用仓库 release flow，不以包目录 raw `npm publish` 作为默认路径。
- `nextclaw` 是已发布 workspace 依赖闭包和嵌入 UI/runtime 产物的产品包，不只看自身版本。
- 发布包必须包含 launcher/app entries 和 `resources/update-bundle-public.pem`。
- NPM runtime manifest 使用 `hostKind: npm-runtime-bundle`，兼容 floor 来自 `packages/nextclaw/npm-runtime-compatibility.json`，只有 launcher 合同破坏才提高。
- Registry、runtime channel、release notes、分支/记录回流和生成物清理按用户授权范围形成一个闭环。

Beta 优先 `pnpm release:beta`；仅 NPM 用 `release:beta:npm`，仅 channel 用 `release:beta:runtime`；stable channel 用 `release:stable:runtime`。

最终报告 package/version/dist-tag、workflow、manifest、真实安装证据、分支闭合和残余 WIP。
