# NPM Runtime Channel

- Beta 使用 `pnpm release:beta:runtime`，stable 使用 `pnpm release:stable:runtime`；dispatch 不是完成，等待 workflow success。
- 验证 `gh-pages/npm-runtime-updates/<channel>/` 的平台 manifest、bundle zip 和 public key，再验证公开 Pages URL。
- Manifest 核对 `latestVersion`、`minimumLauncherVersion`、`hostKind` 和适用的 `releaseNotesUrl`。
- stable `nextclaw` 发布后必须闭合 stable runtime channel，除非用户明确接受并记录例外。
- branch 内容正确但 public URL 旧时，检查 Pages build、artifact 体积和历史 apt pool；修/重试同一发布 identity，不重发 NPM/tag。
