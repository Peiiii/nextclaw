# NPM Runtime Channel

- Beta 使用 `pnpm release:beta:runtime`，stable 使用 `pnpm release:stable:runtime`。正式 stable 由 `npm-release-prepare` 从 exact versioned tree 预构建四平台 Runtime，发布时只 promotion；prepared source/run 缺失时 fail closed，不在正式发布阶段冷构建。
- Runtime workflow 是执行 owner：它自动等待 child、验证 assets/Pages/public manifests 并返回终态；Agent 等待或在线状态不是发布前提，也不得用逐步监控或临时命令推进发布。
- 验证 `gh-pages/npm-runtime-updates/<channel>/` 的平台 manifest、bundle zip 和 public key，再验证公开 Pages URL。
- Manifest 核对 `latestVersion`、`minimumLauncherVersion`、`hostKind` 和适用的 `releaseNotesUrl`。
- stable `nextclaw` 发布后必须闭合 stable runtime channel，除非用户明确接受并记录例外。
- 正式 Runtime promotion 目标预算为 120 秒；冷构建在 master push 后的 prepare 阶段完成。预算失败记录实测最慢步骤并优化 prepare/promotion，不新增人工快速通道。
- branch 内容正确但 public URL 旧时，检查 Pages build、artifact 体积和历史 apt pool；修/重试同一发布 identity，不重发 NPM/tag。
