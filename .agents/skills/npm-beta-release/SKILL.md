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

按需拆分入口：

```bash
pnpm release:beta:npm
pnpm release:beta:runtime
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

它默认按“全量 public workspace beta batch”完成：

1. 为所有 `private=false` 的 workspace 包生成统一 beta changeset
2. `pnpm release:version`
3. `pnpm release:publish`
4. 如有 version / changelog 变更，自动创建 release commit
5. 推送当前分支与本地 package tags
6. 若 batch 包含 `nextclaw`，自动触发 `npm-runtime-update-release` 的 `beta` channel
7. 等待 workflow 成功，并验证：
   - GitHub release assets
   - GitHub Pages 公网 beta manifest

默认原则：

- 用户只说“发布 beta / 发一个新的 beta / 统一 beta 发版”时，默认一口气发布所有 public workspace 包的新 beta 版本。
- 不要只发布“看起来改过”的少量包，因为这会让本地安装、runtime bundle、UI 静态资源和依赖闭包出现版本错觉。
- 只有用户明确要求缩小范围，或存在 npm/CI/registry 阻塞并已向用户说明，才允许使用特殊范围。

特殊范围只能作为受控例外：用户明确要求最小 batch，或 npm/CI/registry 阻塞导致全量 batch 无法继续时，先向用户说明“不走全量 public beta batch”的原因，再手工构造对应 changeset 或专门流程。

如果只需要发布 beta npm 包，不需要开放自动更新通道，使用：

```bash
pnpm release:beta:npm
```

它等价于“只跑 beta 包发布，不触发 runtime channel”。

如果只需要为已发布的 `nextclaw@beta` 闭合自动更新通道，使用：

```bash
pnpm release:beta:runtime
```

它默认读取当前已发布的 `nextclaw@beta` 版本，随后：

1. 触发 `npm-runtime-update-release`
2. 等待 workflow 成功
3. 校验 release assets
4. 校验 `gh-pages` manifest 与公网 beta manifest

## 常用参数

```bash
pnpm release:beta -- --dry-run
pnpm release:beta -- --skip-runtime-channel
pnpm release:beta:npm -- --dry-run
pnpm release:beta:runtime -- --dry-run
pnpm release:beta:runtime -- --version 0.18.12-beta.8
pnpm release:beta -- --minimum-launcher-version-override 0.18.12-beta.3
pnpm release:beta:runtime -- --minimum-launcher-version-override 0.18.12-beta.3
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

发布前还必须联动 `nextclaw-release-notes-automation`：

- 先汇总未发布 `.changeset`，生成本次用户可读变更摘要。
- 若明确有用户可见产品变更但缺少 `.changeset`，先补齐再发布。
- 不能只用 full public beta batch changeset 代替具体变更说明。

## 本地安装验证契约

发布后验证必须使用真实发布版本，不允许把 workspace link、源码构建或本地 `packages/nextclaw` 路径当作用户安装态：

```bash
npm install -g nextclaw@beta
nextclaw --version
nextclaw restart --ui-port <port> --start-timeout 45000
```

验收时必须确认：

- `npm ls -g nextclaw --depth=0` 显示刚发布的 beta 版本。
- 运行进程路径位于全局 npm 安装目录，例如 `.../lib/node_modules/nextclaw/dist/...`，不能是仓库 workspace 路径。
- `/api/app/meta` 的 `productVersion` 与 `nextclaw --version` 一致。
- 首页加载的 hashed UI assets 来自已发布包，必要时从全局安装目录或 npm tarball 对照。
- 若验证 UI 修复，必须用浏览器或等效工具确认页面实际行为，而不是只 grep 源码。

## 完成判定

只有同时满足下面条件，才算 beta 发布真正完成：

1. npm registry 上能看到本次全量 public beta batch 版本；若不是全量，必须说明例外原因
2. 本地 release commit 与 tags 已推送
3. 若 batch 包含 `nextclaw`：
   - `npm-runtime-update-release` workflow 成功
   - 对应 GitHub release 挂上四个平台 runtime zip
   - 公网 `beta` manifest 的 `latestVersion` 指向这次版本

## 回答模板

向用户汇报时，至少给出：

- 入口命令：`pnpm release:beta` / `pnpm release:beta:npm` / `pnpm release:beta:runtime`
- 本次发布 batch
- release commit
- 是否触发 runtime channel
- workflow URL
- public manifest 校验结果
- 真实 npm 安装验证结果，包含安装路径是否为全局 npm 包而非 workspace link

## 关系说明

- 这个 skill 是发布 owner。
- NPM 发布合同细则继续复用 `npm-release-contract-guard`。
- 如果只是解释发布机制，可说明入口和边界，不必真的执行发布。
