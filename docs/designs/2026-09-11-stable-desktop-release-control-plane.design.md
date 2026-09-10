# Stable 全平台发布中的 Desktop 控制面选择

## 问题与证据

2026-09-11 的 `release.yml target=all` run `34539942465` 已完成 NPM、跨平台 Node 安装矩阵与 stable Runtime，随后 Desktop job 在创建并复用隐藏 Draft `v0.53.0-desktop.1` 后失败。

失败链路为：

1. 父 workflow 从 dispatch SHA `93643448f` 启动。
2. NPM owner 生成 release commit `831264fcd`，创建 package tags 并推进 `origin/master`。
3. Desktop job 仍 checkout `github.sha`，再把该提交绑定为本地 `master`。
4. `release-desktop.mjs` fetch `origin/master` 后发现本地分支落后一个提交，按安全合同拒绝继续。

因此失败不是 Desktop 构建、签名或平台产物问题，而是父 workflow 没有区分首次发布与恢复时的控制面来源。

## 不变量与 owner

- `publish-npm` 是 stable package identity、release commit 与 Git 闭合的 owner；其 `closure_commit` 是首次发布后已同步到 `origin/master` 的控制面事实。
- `release.yml` 是全平台阶段编排 owner，负责选择 Desktop job 使用哪个控制面提交。
- `desktop_target` 是不可变 Desktop 产品源码目标；它与运行发布脚本的控制面 checkout 是两个独立事实。
- `release-desktop.mjs` 保留“本地发布分支不得落后远端”的 fail-closed 检查，不为 workflow 的旧 checkout 放宽安全边界。
- 恢复必须复用已发布的 `nextclaw@0.53.0`、Runtime assets 与隐藏 Draft `v0.53.0-desktop.1`，不得重复 NPM/Runtime 或创建新 Desktop identity。

## 方案

Desktop job 的 checkout 根据 `publish-npm.outputs.is_recovery` 选择：

- 首次发布：checkout `publish-npm.outputs.closure_commit`。此时 NPM owner 已推进远端主线，Desktop 从闭合后的同步控制面继续。
- 恢复发布：checkout `github.sha`。恢复 run 可以使用当前主线上的修复过的发布控制面，同时 `desktop_target` 继续指向已发布身份允许的不可变产品提交。

checkout 后的 branch bind 必须先读取实际 `HEAD`，再把同一个提交绑定为本地 `master`。它不能重新使用 `GITHUB_SHA`，否则首次发布刚选中的 `closure_commit` 会在下一步被覆盖。

Desktop builder 的 `--target` 保持使用 `publish-npm.outputs.desktop_target`；不把控制面 SHA 偷换成产品 target。

这个条件直接留在父 workflow，不新增 wrapper、fallback、版本特判或第二套恢复入口。`release-desktop.mjs` 的分支安全检查、Draft 推断、幂等恢复和下游发布合同均不改变。

## 放弃的候选

- 始终 checkout `closure_commit`：首次发布正确，但恢复 run 无法使用当前主线上的发布修复，违背“新控制流程恢复旧产物”的合同。
- 始终 checkout `github.sha` 并允许远端 ahead：会掩盖真实分支漂移，还可能让 Desktop owner 从旧控制面继续写远端。
- 在 Desktop job 中 pull/merge：把 Git 状态迁移塞进 Desktop owner，增加新的可变提交和冲突面；父 workflow 已拥有正确的确定性来源，不需要运行时拼接。

## 验收合同

| ID | Required | 场景与可观察结果 | 失败判定 |
| --- | --- | --- | --- |
| FIX-1 | true | 首次 `target=all` 在 NPM 推进主线后，Desktop checkout 使用 `closure_commit`，branch bind 保留该实际 HEAD | checkout 或 bind 任一步重新使用原 dispatch SHA，或放宽 behind 检查 |
| FIX-2 | true | stable recovery 使用当前 `github.sha` 运行修复后的控制面 | recovery 被固定到旧 release commit |
| FIX-3 | true | 两种模式都把 `desktop_target` 单独传给 Desktop builder | `--target` 改成控制面 SHA 或丢失不可变产品目标 |
| FIX-4 | true | workflow 静态检查与发布编排合同测试通过 | actionlint 或定向测试失败 |
| FIX-5 | true | 复用 `v0.53.0-desktop.1` 完成五平台 assets、stable manifest、APT 与公开 Release | 新建 identity、重复 NPM/Runtime，或任一 Desktop 发布面未闭合 |

## 交付与边界

实现只修改 `.github/workflows/release.yml` 与对应编排合同测试。修复提交进入 `master` 后，通过同一 `release.yml target=all` 的 recovery mode 复用 `0.53.0`；NPM 和 Runtime 已有成功证据不重跑不可逆发布。用户无需执行人工 pull、rerun 或 Desktop 原子命令。

本设计不改变 Desktop 产物格式、签名、launcher floor、版本号、渠道或更新协议，也不处理与本次失败无关的平台构建问题。
