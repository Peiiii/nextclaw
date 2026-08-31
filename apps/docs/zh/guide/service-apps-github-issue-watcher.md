# GitHub Issue Watcher

GitHub Issue Watcher 是一个把仓库 Issue 留在本地查看的小应用。它把 Panel、保存的数据、受控网络访问、可选 GitHub Token，以及可供 Agent 和命令行调用的操作放在同一个应用里，是一个完整的真实例子。

## 它能做什么

输入仓库，例如 `Peiiii/nextclaw`，然后点击“同步 Issue”。应用会从 GitHub 读取最近的 Issue，并保存到自己的数据空间里。之后可以在 Panel 中切换未关闭、已关闭和全部 Issue，不必每次筛选都再请求 GitHub。

公开仓库不需要 Token。私有仓库或需要更高 GitHub API 额度时，先配置可选的 `github-token` 密钥槽位。应用只会在请求时读取这个密钥，不会把它写到 Panel、Issue 列表、操作结果或日志里。

## 安装和使用

1. 从应用列表或 `.napp` 安装 **GitHub Issue Watcher**。
2. 打开应用，输入 `owner/repository` 格式的仓库名。
3. 阅读访问 `api.github.com` 的请求后，同步 Issue。
4. 在 Panel 中筛选已经保存的 Issue；需要时点击某条 Issue 跳转 GitHub。

这个应用只请求 `api.github.com`，不会通过此应用拿着 Token 访问其他域名。

## 和 Agent 或命令行一起使用

如果希望 Agent 刷新仓库后处理结果，可以把 `issues_sync` 授权给它。例如：“同步 `Peiiii/nextclaw`，再列出最早的三个未关闭 Bug。”Agent 调用的是与 Panel 相同的操作，也会受到相同的输入校验。

```bash
nextclaw app invoke nextclaw.github-issue-watcher issues_sync \
  --input '{"repository":"Peiiii/nextclaw"}' --json
nextclaw app invoke nextclaw.github-issue-watcher issues_list \
  --input '{"state":"open"}' --json
```

第二个命令读取的是应用已经保存的快照，不需要再次访问 GitHub。

## 同步失败时

- 确认仓库值符合 `owner/repository` 格式。
- 私有仓库先在应用密钥设置中绑定并验证 `github-token`。
- 确认宿主可以访问 `api.github.com`。
- 打开应用验证记录，查看这次操作的脱敏事实和错误代码。

通用恢复方法见 [Service Apps 故障排查](/zh/guide/service-apps-troubleshooting)。
