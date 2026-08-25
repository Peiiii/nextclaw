# 0.43.0 全平台正式版发布工作记录

## 观测口径

- 以 GitHub Actions、registry、公开 Release、manifest、APT 和主线协调器输出为准。
- 每个阶段记录 wall time、最慢 job/step、外部等待、失败重试和恢复入口。
- 已成功的不可逆 identity 不重复发布。

## 阶段观测

| 阶段 | 状态 | 耗时/最慢项 | 发现与处理 |
| --- | --- | --- | --- |
| 范围审计 | 完成 | product dry-run 3.6s | 44 个版本变化、43 个上传包；发现 patch 推导与缺失结构化 Notes，在发布前修正为 0.43.0 minor |
| Exact-commit prepare | 完成 | source `93ca7612c0e35326dc427a9698f059aabd5487f5` | 冻结 artifact 后由正式 workflow 消费；未在 publish 窗口重建 |
| NPM stable | 完成 | workflow `32803630382`；成功 attempt 1m49s | 首次因 environment 旧 Token 报 EOTP；同步项目 `.npmrc` 中已确认 bypass 2FA 的 token 后，43 个包上传成功。registry 在固定短等待内仍有 2 个包未暴露，failed-job rerun 只复用已有 identity，没有重复 publish |
| Runtime / install | 完成 | Runtime job 6m21s；child workflow `32804069203` | Linux x64、Windows x64、macOS x64/arm64 bundle 与 stable manifest 成功；0.42.3 经 check/download-only/apply/new-process 升级到 0.43.0 |
| Desktop stable | 完成 | workflow `32804702855`，wall 24m09s；最慢 macOS x64 job 17m49s | 五平台、30 资产、五份 manifest、APT 0.0.267 均通过；本地 closure 额外因完整 `gh-pages` fetch 下载/解包约 210MB，耗时约 6 分钟 |
| 主线对账 | 完成 | `LOCAL_MAINLINE_SYNCED` | release commits `522b0f16b`、`768e9b712` 已安全回流本地 `master` |
| X 发布 | 外部受阻 | 一次请求即失败 | X 返回 226 自动化保护；回读确认没有产生重复帖子，未盲目重试，不影响核心或 Desktop release identity |
| 自动化加固验证 | 完成 | 46 项发布合同测试 0.85s；raw manifest/APT 读取均为 0 秒级 | ESLint、skill progressive-loading、new-code governance 与 backlog ratchet 通过；隔离 update fixture 自动构建 207.5s 后进入人工 UI 步骤，已停止清理，不将该入口冒充无人值守验证；正式 workflow 的 0.42.3→0.43.0 自动升级 smoke 作为真实证据 |

## 提效复盘

- GitHub Actions 发布 NPM 已真实跑通；当前生产认证是 `npm-production` environment 的 `NPM_TOKEN`，不是尚未配置完成的 Trusted Publishing。两者不能再混为“有没有 GitHub 自动发布”。
- NPM 上传、registry 可见性和 Git/Runtime 闭环必须分开计时；registry 短暂不可见只允许重查 identity，禁止再次 publish。
- `NPM_READY` 是事实完成门，60 秒是性能观测目标。性能目标未达只记录 SLA missed，不得把成功发布判失败并诱发重跑。
- Desktop Actions wall time 24m09s 是当前真实端到端上界样本；本地 closure 的完整历史 fetch 属于纯浪费。真实浅抓取探针仍超过 60 秒，因此最终删除 Git fetch，改为读取单个 raw manifest 后再核验 Pages 公网投影。
