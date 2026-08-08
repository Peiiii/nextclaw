# Desktop 发布恢复

- 已有 tag/release 和有效 assets 时，不为下游发布失败创建新 identity。
- build/smoke/bundle/manifest/asset 内容失败且 delivered bits 改变：修 owner 后使用新 identity。
- update channel 或 APT 在 assets 后失败：修 workflow，用现有 `release_tag` 重新触发；build jobs 仍 checkout 原 tag。
- 本地 GitHub 查询遇到 EOF/TLS/DNS/timeout/5xx，先检查已有 run/tag/release；恢复 closure，不把查询失败当发布失败。
- `gh-pages` branch 已更新而 public URL 旧：检查 Pages deploy/体积并等待或修发布面，不创建新 release。
- Docker registry/network、artifact upload stalled、git ref lock 等基础设施故障优先 rerun existing workflow/closure。
- 部分发布必须明确报告，直到 rerun、assets、branch manifest、public manifest 和 stable APT 同一版本才完成。
