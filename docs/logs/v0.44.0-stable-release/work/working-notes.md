# NextClaw 0.44.0 发布工作记录

## 当前目标

通过单次 GitHub Actions `release.yml target=product` 完成 `nextclaw@0.44.0` 的 NPM、stable Runtime、真实升级、GitHub Release 和主线闭环。

## 当前事实

- 发布源分支：`codex/release-false-failure-audit`，基线为远程 `master`，包含发布失败语义修复提交 `0bc495696`。
- 远程 `master` 当前提交：`667c4fd6656500e3f264b8715dc629d1c3715cd1`。
- 最近成功正式入口：GitHub Actions run `32803630382`，认证为 `npm-production/NPM_TOKEN`。
- 当前公开稳定版：`nextclaw@0.43.0`，`latest` 指向 `0.43.0`。
- 未发布批次包含 7 个 changeset；`nextclaw` 目标提升为 minor `0.44.0`。
- 主工作区有用户 WIP，禁止 checkout、stash、reset 或混入发布。

## 关键约束 / 不变量

- 只触发 `target=product`；Desktop 不在本次授权范围。
- 不重复 publish 已经成立的 package identity；失败按同一 release identity 恢复。
- pending/retry 不判为 hard failure；确定性合同冲突必须阻止发布。
- 只有 registry、Runtime、真实升级、GitHub Release 和主线回流全部有证据时才报告完成。

## 证据 / 观察点

- `release:check:health` 和 `release:check-readmes` 通过。
- `release:summary -- --json` 无错误，截图路径有效。
- 文档构建通过；stable release 合同测试 21/21 通过；发布脚本测试 98/98 通过。
- GitHub Actions run、各 job/step 起止、最慢 step、重试与外部等待尚待真实运行采集。

## 活跃假设

- release-bearing `master` push 会为 exact SHA 自动创建可复用的 NPM prepare artifact。
- `target=product` 会消费 exact artifact，并在 NPM_READY 后发布 stable Runtime 与验证旧版升级。

## 已排除项

- 未使用 Trusted Publishing/OIDC；当前生产路径仍是受控 `NPM_TOKEN`。
- 不把本机 Node 25/Python 3.14 的 `better-sqlite3` 编译问题当成 GitHub Node 22 发布环境故障。
- 不从主工作区发布，避免混入 landing 页面与未跟踪设计稿 WIP。

## 关键决策

- 版本选择 `0.44.0`，因为批次包含向后兼容的新用户能力。
- 在 dispatch 前补齐双语 notes、结构化 JSON 和 minor release surface review，避免形成半成品内容状态。

## 下一步

1. 提交 release preparation 材料并把冻结提交安全交付到远程 `master`。
2. 等待 exact-commit `npm-release-prepare` artifact 成立。
3. 单次 dispatch `release.yml target=product` 并持续观察到最终状态。
4. 回读 registry、GitHub Release、Runtime manifest、真实升级证据与主线状态。
5. 回填实测耗时和最终结果，运行 `release:reconcile:mainline`。

## 剩余缺口 / 交接提醒

- 尚未执行任何不可逆 publish。
- 恢复时必须先读取同 SHA 的 workflow run，不得重新发布已经成功的包。
