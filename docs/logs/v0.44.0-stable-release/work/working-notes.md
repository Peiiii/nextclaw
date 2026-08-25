# NextClaw 0.44.0 发布工作记录

## 当前目标

通过单次 GitHub Actions `release.yml target=product` 完成 `nextclaw@0.44.0` 的 NPM、stable Runtime、真实升级、GitHub Release 和主线闭环。

## 当前事实

- 发布源提交：`579aff6d9`；release commit：`c731ebcb1`。
- 正式入口：GitHub Actions run `32877479224` attempt 2，最终 `success`，认证为 `npm-production/NPM_TOKEN`。
- 当前公开稳定版：`nextclaw@0.44.0`，`latest` 指向 `0.44.0`。
- 23 个 package identity 全部可见；GitHub Release 有四份 Runtime ZIP；四份 stable manifest 均指向 `0.44.0`。
- 主工作区有用户 WIP，禁止 checkout、stash、reset 或混入发布。

## 关键约束 / 不变量

- 只触发 `target=product`；Desktop 不在本次授权范围。
- 不重复 publish 已经成立的 package identity；失败按同一 release identity 恢复。
- pending/retry 不判为 hard failure；确定性合同冲突必须阻止发布。
- 只有 registry、Runtime、真实升级、GitHub Release 和主线回流全部有证据时才报告完成。

## 证据 / 观察点

- `release:check:health` 和 `release:check-readmes` 通过。
- `release:summary -- --json` 无错误，截图路径有效。
- 文档构建通过；stable release 合同测试 21/21 通过；发布脚本测试 99/99 通过。
- prepare run `32876862383`：5 分 57 秒。
- 正式 run 从首次创建到恢复完成：22 分 59 秒；从 release-bearing push 到产品闭合：29 分 19 秒。
- attempt 1 package stage：152.19 秒；23 个 publish 命令成功，但 2 个 identity 在 120 秒后仍不可见。
- attempt 2 NPM job：6 分 38 秒，其中 checkout 5 分 51 秒，prepared publish/Git 闭合 17 秒，明确为 0 upload、23 reuse。
- Runtime job：9 分 13 秒；最慢有效工作 step 是四平台 Runtime 发布与验证，6 分 42 秒；旧版升级验证 35 秒。

## 活跃假设

- 无。授权范围内的发布事实已经全部成立。

## 已排除项

- 未使用 Trusted Publishing/OIDC；当前生产路径仍是受控 `NPM_TOKEN`。
- 不把本机 Node 25/Python 3.14 的 `better-sqlite3` 编译问题当成 GitHub Node 22 发布环境故障。
- 不从主工作区发布，避免混入 landing 页面与未跟踪设计稿 WIP。
- 排除包内容或权限错误：恢复尝试没有再次上传，23 个 prepared integrity 已全部公开可见。

## 关键决策

- 版本选择 `0.44.0`，因为批次包含向后兼容的新用户能力。
- 在 dispatch 前补齐双语 notes、结构化 JSON 和 minor release surface review，避免形成半成品内容状态。
- 将成功 publish 后的 registry propagation 默认等待窗从约 120 秒延长到 15 分钟；等待期间不重复上传，integrity 冲突仍立即失败。

## 下一步

1. 完成 registry 等待窗修复的验证与 Review。
2. 把修复和最终发布记录安全回流远程 `master`。
3. 运行 `release:reconcile:mainline`，保护主工作区 WIP 并确认自动同步状态。

## 剩余缺口 / 交接提醒

- NPM、Runtime 与 GitHub Release 已完成，不得再次 dispatch `0.44.0`。
- Desktop 不在本次授权范围，保持未发布。
