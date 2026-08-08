# Linear 领取合同

## 预检

读取 issue 正文、评论、附件、关系、标签、状态、已有分支/PR；调查仓库、验收条件、权限和 WIP。描述短不等于直接退回。默认定位本地 master worktree，冻结 SHA、路径和 WIP 内容指纹；不 fetch/pull/stash/reset。

只有产品方向存在无法裁决分歧、依赖语义重叠 WIP、缺少必需权限/环境、不能形成独立价值或无法可靠取证 master/WIP 时退回。dirty 本身不是阻塞。

## Claim

生成稳定 Run ID，重新确认资格并搜索现有 claim/branch/commit/PR。写领取评论，短暂等待后以服务端 createdAt、再以 comment ID 决定唯一 winner；loser 只写取消说明并退出。winner 替换为 `Agent: Claimed`、状态改 `In Progress` 并回读确认后才改仓库。

领取模式在本 Run 冻结：明确 PR 例外走 PR，否则本地 master。标签更新始终保留完整用户标签集。
