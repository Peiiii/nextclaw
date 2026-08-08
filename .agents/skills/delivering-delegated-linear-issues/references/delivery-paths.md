# Linear 交付路径

## 共同路径

- 独立 worktree/分支包含 issue ID，不复制用户 WIP。
- 使用 delivery workflow 调查、实现、验证、changeset/迭代判断；只提交当前 issue，委派授权本地 commit。
- 发现邻近问题只记录，除非它阻塞当前交付。

## Ready PR 例外

只有明确 PR/禁止本地合并说明才授权 push 分支并创建 ready PR；不自动 merge、release 或 deploy，也不把本地合入阻塞擅自降级为 PR。

## 本地 master 默认

交付分支从冻结的本地 master SHA 开始。合入前重读 Linear、比较 master、更新并重验交付分支；对交付路径与 staged/unstaged/untracked WIP 做双向路径和语义重叠审计，并记录内容指纹。

没有明确冲突时只尝试 `git merge --ff-only`。Git 拒绝、冲突、分叉、指纹无法可靠取得时停止并保留 commit，不 stash/reset/rebase master/force/push。成功后确认 master 指向交付 commit、原 WIP 内容和 staged 属性不变，再在干净隔离 worktree 做合并后 smoke。

合入后 WIP 指纹变化或 smoke 失败属于高风险异常，停止批次并请求人工恢复；只允许可证明不触碰 WIP 的向前修复。
