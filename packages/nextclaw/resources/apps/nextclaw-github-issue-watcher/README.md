# GitHub Issue Watcher

这是一个可以直接安装的参考应用：输入 `owner/repository`，它会同步 GitHub 最近的 Issue，保存在此应用自己的数据空间，并在 Panel、Agent 和已安装应用 CLI 中使用同一组 Action。

## 用户如何使用

1. 在应用面板输入仓库，例如 `nextclaw/nextclaw`，再点击“同步 Issue”。
2. 用“打开的 Issue / 已关闭的 Issue / 全部 Issue”筛选已保存的数据；点击任意 Issue 会前往 GitHub。
3. 私有仓库或更高请求额度时，在应用的 Secret 设置中将 `github-token` 绑定到 GitHub Token。Token 只通过 `wasi:config/store` 读入请求的 `Authorization` header，绝不会返回到 Panel、Action 输出或日志。

Agent 与 CLI 调用的是同一组动作：

```bash
nextclaw app invoke nextclaw.github-issue-watcher issues_sync --input '{"repository":"Peiiii/nextclaw"}'
nextclaw app invoke nextclaw.github-issue-watcher issues_list --input '{"state":"open"}'
```

## 从源码构建

`guest/` 自包含 Rust 源码、锁文件和 WIT 依赖；不需要从 NextClaw 仓库借用 Guest 合同。

```bash
cd guest
cargo component build --release --target wasm32-wasip2
cp target/wasm32-wasip1/release/nextclaw_github_issue_watcher.wasm \
  ../service-components/nextclaw-github-issue-watcher-service/service.wasm
cd ..
nextclaw app check .
nextclaw app test .
nextclaw app pack . --out github-issue-watcher.napp
```

在可直连 GitHub 的 CI 或开发环境中，可用正式 runner 做一次真实同步闭环：

```bash
node tests/public-github-runner-smoke.tools.mjs \
  --runner /path/to/nextclaw-wasmtime-runner \
  --repository Peiiii/nextclaw
```

它会先读取空数据，再同步公开仓库并再次读取，检查标准 WASI HTTP、标准 KV 持久化，以及返回的 Issue 编号、标题和 GitHub 链接。这个脚本不提供 Token，也不会读取或输出 Secret。

本应用只使用标准 WASI 能力：`wasi:http/outgoing-handler@0.2.6` 请求 GitHub、`wasi:keyvalue/store@0.2.0-draft2` 保存同步结果、`wasi:config/store` 读取可选 Token，以及 `wasi:clocks/wall-clock` 记录实际同步时刻。网络目标由 manifest 的 `allowedDomains` 限制为 `api.github.com`。
