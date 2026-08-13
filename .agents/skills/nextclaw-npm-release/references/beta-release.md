# Beta 发布

统一入口：

```bash
pnpm release:beta
```

它默认发布全部 `private=false` workspace 包的新 beta batch，执行 changeset/version/publish、release commit 和 tags；batch 含 `nextclaw` 时继续触发 beta runtime channel，并等待 workflow、release assets 和公网 manifest 成功。

只拆分阶段时使用：

```bash
pnpm release:beta:npm
pnpm release:npm:beta
pnpm release:beta:runtime
```

- `release:npm:beta`：面向清晰用户意图的 NPM-only 入口；只发 npm 包、做 registry/真实安装验证并报告 `NPM_READY (channel: beta)`。
- `release:beta:npm`：上述入口的兼容命令；只发 npm 包，不开放 runtime channel。
- `release:beta:runtime`：对已发布的 `nextclaw@beta` 闭合 runtime workflow、assets、Pages 与公网 manifest。

常用参数：

```bash
pnpm release:beta -- --dry-run
pnpm release:beta -- --skip-runtime-channel
pnpm release:beta:runtime -- --version <version>
pnpm release:beta:runtime -- --minimum-launcher-version-override <version>
```

`--minimum-launcher-version-override` 只用于 recovery publish；没有明确原因不跳过 runtime channel，也不抬高 compatibility floor。

## 发布合同

- 用户只说“发布 beta”时默认 full public workspace batch；只有用户明确缩小范围，或 registry/CI 阻塞且已说明时才使用窄 batch。
- 工作区必须满足发布入口的 clean 要求，`.changeset/pre.json` 为 `mode=pre`、`tag=beta`，并具备 `pnpm`、`gh`、`curl`。
- 发布前由 release-notes owner 汇总具体用户变化；full-batch changeset 不能替代产品更新说明。进入用户安装或 runtime channel 时闭合 `releaseNotesUrl`，无用户变化才说明不适用。
- batch 含 `nextclaw` 时，包内容、依赖闭包、public key、manifest compatibility 和 runtime update 均遵守本 NPM 发布 owner 的永久合同。

## 发布后证据

真实安装验证必须使用 registry 版本，不能用 workspace link 或源码目录冒充：

```bash
npm install -g nextclaw@beta
nextclaw --version
nextclaw restart --ui-port <port> --start-timeout 45000
```

确认 `npm ls -g nextclaw --depth=0`、运行进程路径和 `/api/app/meta.productVersion` 都指向刚发布的全局包；需要证明 UI 修复时检查实际页面及已发布 hashed assets。

NPM-only 完成条件：registry 包和 `beta` dist-tag 正确，release commit/tags 已推送，batch 含 `nextclaw` 时真实 registry 安装通过；报告 `NPM_READY`，不得暗示 runtime channel 已开放。

Full beta 完成条件：在 NPM-only 条件之外，batch 含 `nextclaw` 时 workflow 成功、四平台 runtime assets 完整、公网 beta manifest 指向本版本；最终报告 batch、入口、commit、workflow、manifest、更新笔记和真实安装证据。
