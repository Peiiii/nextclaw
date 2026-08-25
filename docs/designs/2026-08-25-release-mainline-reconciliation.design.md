# 发布主线自动对账设计

## 问题与目标

NextClaw 正式发布从隔离 worktree 或 GitHub Actions 推进远程 `master` 时，本地主工作区可能同时存在已提交开发结果或未提交编辑。现有闭环要求本地目标 worktree 能直接 `git merge --ff-only`；一旦本地与远程分叉，发布虽然已经完成，主工作区却会停在旧提交并等待人工 rebase，形成“远程已发布、本地仍落后”的长期不一致。

目标是让发布和并发开发无需人工看管地持续运转：发布只依赖已经冻结的远程主线；本地主工作区的活跃编辑不被 stash、reset、rebase 或覆盖；已提交的本地 `master` 结果可在隔离环境中自动并回远程；所有阶段都有机器可读状态与耗时。

## 当前链路与违反点

当前 producer 是隔离发布 worktree 或 GitHub Actions，权威发布事实落在 `origin/master`、tag、Release 和 update channel。默认主工作区只是一个本地 consumer，但 `release-stable-git.mjs` 同时把它当作远程 push 的前置 owner：必须先在该 worktree 快进目标分支，才能继续远程闭合。

这违反了以下原则：

- `single-complete-owner`：远程主线和活跃本地 worktree 同时被当作发布主线 owner。
- `minimal-responsibility-surface`：发布被迫理解并修改与本次发布无关的本地编辑现场。
- `equivalence-by-construction`：依赖事后人工 rebase 维持本地/远程一致，而不是让所有交付从同一远程主线串行闭合。

## 候选方案

### 方案 A：发布后自动 rebase 本地 `master`

优点是线性历史。缺点是会重写本地提交；目标分支正被编辑、存在 staged 内容或其他进程同时写文件时，无法安全更新 worktree。冲突会把活跃工作区留在半完成状态，不能作为无人值守默认路径。

### 方案 B：发现本地状态后自动 stash、更新、再恢复

可以处理部分未提交编辑，但 stash/apply 仍可能冲突，会改变 staged 属性、未跟踪文件和工具正在使用的文件状态。发布任务也没有权利替并发开发任务解释冲突，不采用。

### 方案 C：远程主线为唯一发布 owner，隔离 worktree 自动合并

发布始终绑定冻结的 `origin/master` SHA。发布结束后，本地协调器只读取主工作区状态：

1. 本地与远程一致：直接完成。
2. 本地只落后且主工作区干净：安全 fast-forward。
3. 本地存在独有提交：在临时 integration worktree 中从本地提交创建候选，合并最新 `origin/master`，验证后以普通 fast-forward push 更新远程；不 rebase、不 force push。
4. 主工作区有活跃编辑：不改它。协调器立即闭合远程，并启动有持久状态的本地 retry worker；worker 在 Git 状态变化或轮询命中可安全窗口时自动 fast-forward，不把动作留给人。
5. 出现真实合并冲突：冲突只存在于隔离 integration worktree，发布结果保持有效。当前发布 Agent 直接进入该恢复 worktree 解决、验证并续跑；恢复入口和证据保留在 common Git dir，不要求用户处理活跃工作区。

该方案保留本地提交祖先关系，因此远程合并成功后，本地主工作区无需重写历史，最终只需 fast-forward。选择本方案。

## 权威 owner 与主链路

远程 `origin/master` 是发布与交付的唯一主线 owner。`reconcile-release-mainline.mjs` 是本地对账 owner，只负责读取本地分支/工作区状态、在隔离 worktree 合并已提交历史、执行验证、普通 push 和空闲 fast-forward；它不拥有 NPM、Runtime、Desktop 或 Release 状态。

最小完整路径：

```text
冻结 origin/master SHA
  -> GitHub Actions / 隔离 worktree 发布
  -> 远程 artifacts、channel、master 闭合
  -> 本地主线协调器（发布完成事件自动触发）
     -> 一致 / 干净快进
     -> 隔离合并 + 验证 + 普通 push
     -> 活跃 worktree 由 retry worker 自动完成物理快进
```

## 状态与不变量

- 发布绝不从未提交文件构建，也不把活跃编辑静默带入发布。
- 协调器绝不执行 stash、reset、rebase、force push 或直接更新脏 worktree 的 branch ref。
- 本地独有提交只通过保留祖先关系的 merge 进入远程；成功后本地旧 `master` 必须是新远程主线的祖先。
- 任何 push 都要求候选包含调用时观察到的远程 HEAD；远程竞态导致 non-fast-forward 时重新 fetch、merge、验证和有界重试。
- 本地主工作区脏时允许物理指针短暂落后，但远程发布闭环不能因此失败；协调器必须自动启动 retry worker，状态明确为 `remote-closed/local-worktree-retrying`，不能伪报完全同步，也不能要求用户稍后手工执行命令。
- 新开发任务默认在隔离分支/worktree 进行；默认主工作区的 `master` 作为可自动快进镜像，不再承载长时间开发提交。

## 自动化与观测

新增 `pnpm release:reconcile:mainline`。所有正式 NPM、Runtime、standalone Desktop 和 GitHub Actions 全平台父 workflow 都在远程完成门之后调用它；开发 Delivery 在本地主线写入前后也调用同一个 owner。一次调用先同步执行远程闭合；只有物理 worktree 因活跃编辑无法更新时，才派生单例 retry worker。worker 默认持续运行到同步成功，PID、目标 SHA、最近状态和日志保存在 common Git dir 下，重复触发复用同一实例；机器重启后由下一次开发/发布入口幂等恢复，不依赖用户操作。脚本输出稳定的 `nextclaw.release-mainline-reconciliation/v1` JSON，至少包含：

- 开始、结束和 wall time；
- 初始/最终本地与远程 SHA；
- ahead/behind 数量、worktree 是否活跃；
- 所选策略、重试次数、验证命令与耗时；
- push、fast-forward、deferred 或 isolated-conflict 结果。

发布总状态区分：

- `REMOTE_RELEASE_READY`：公开发布与远程主线已成立；
- `LOCAL_MAINLINE_SYNCED`：本地主工作区也已同步；
- `LOCAL_WORKTREE_RETRYING`：仅物理 worktree 因活跃编辑延后，retry worker 已接管，不要求发布者介入；
- `MAINLINE_RECONCILIATION_RECOVERING`：隔离冲突已交给当前或自动唤醒的修复任务，不能回滚或重发已完成版本。

## 失败与恢复边界

- 网络或远程竞态：有界重试，不重复 NPM/runtime/desktop 发布。
- 验证失败：保留 integration 分支和证据，不 push。
- 合并冲突：中止临时 worktree 内的 merge，保留可恢复分支；主工作区不变。
- 活跃编辑持续存在：单例 retry worker 继续低频观察；开发任务开始/结束、commit/merge 和下一次发布事件也会幂等唤醒，不需要用户执行同步命令。
- 远程已经包含本地提交：按祖先关系识别，不重复 merge。

## 删除与禁止的平行路径

- 删除“发布必须先改写默认主工作区才能 push 远程”的耦合。
- 禁止把自动 rebase、自动 stash 或 force push 作为发布恢复路径。
- `release:check:branch-closure` 保留为内容审计，不再承担本地 worktree 状态迁移。
- 不新增数据库或通用任务队列；只允许一个按需存在、达到同步后自动退出的轻量 retry worker，不建设常驻发布服务。

## 验证标准

使用临时 Git 仓库覆盖：

1. 完全同步时幂等成功；
2. 本地只落后且干净时自动 fast-forward；
3. 本地与远程各有提交时，在隔离 worktree 生成 merge、验证并普通 push，主工作区最终可 fast-forward；
4. 主工作区存在不重叠或重叠的 tracked/untracked/staged 编辑时均不修改任何文件和 staged 属性，并自动启动单例 retry worker；
5. 合并冲突只污染隔离分支，主工作区和远程保持原状；
6. 远程竞态时重新集成并有界重试；
7. retry worker 在 worktree 可安全更新后自行 fast-forward 并退出；重复触发不产生多个 worker；
8. 每条路径输出合法的 v1 telemetry，失败路径保留已完成阶段和耗时。

## 非目标

- 不让发布流程自动判断任意语义冲突的业务正确答案。
- 不把尚未提交的开发内容纳入发布或远程主线。
- 不自动猜测任意语义冲突的业务答案；冲突恢复由发布 Agent 自动继续，脚本只保证隔离、证据和可续跑入口。
