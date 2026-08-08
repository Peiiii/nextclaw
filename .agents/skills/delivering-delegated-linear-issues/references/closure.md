# Linear 收尾与恢复

## 成功

先写包含 Run、结果、PR/本地 master、commit、修改、验证、功能验收、风险和未执行项的评论；再改 `In Review`，替换为 `Agent: Delivered`，最后回读三项。任一失败不宣称完整交付。

## 阻塞

合入前阻塞时保留验证完成的分支/commit，写已确认事实、最小所需输入和未执行项；恢复 `Todo`，替换为 `Agent: Blocked` 并回读。任务特定阻塞继续队列，系统授权/仓库不可用或合入后异常停止批次。

用户运行中移除 Delegated 视为撤销授权：停止新增副作用，恢复 Todo/Blocked，不重新添加用户标签。

## 恢复

对遗留 Claimed 先查同 Run 评论、分支、commit、PR 和本地 master；完整交付归一化 Delivered，明确退回归一化 Blocked，状态不明只报告，不抢占或重跑。部分创建的 commit/push/PR/comment 从真实状态恢复，不重复创建。
