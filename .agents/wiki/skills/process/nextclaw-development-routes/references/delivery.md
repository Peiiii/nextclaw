# NextClaw 交付合同

发布按项目命令语义：清晰自然语言与 `commands/commands.md` 的命中条目等价；“发布 NPM”只进入 NPM package owner，“发布 NextClaw 正式版”包含 NPM 与常规 runtime/product closure，“桌面版”或“全平台版”才授权 desktop。release/deploy 使用[任务遥测方法](../../development-task-telemetry/SKILL.md)记录阶段、耗时、等待、重试和人工边界；结束时按现有发布合同报告 `AUTOMATION_INTERVENTIONS: <n>`。单次 dispatch 后冻结 identity/protocol，按 checkpoint 幂等恢复，不让用户或 Agent 人工拼版本、SHA、阶段参数。

公开内容候选仅在 Validation/Review 已形成稳定证据，且成果明显改变用户任务、有可解释 before/after、解决可复用 AI 原生问题或有真实指标/界面时进入博客 owner；常规修复、内部重构、纯 changeset 和证据未稳定时跳过。命中不等于授权发布，上线、导航、配图和社交各守自己的边界。发布终态必须覆盖适用 artifact、manifest、update channel、release notes、部署后 smoke 与分支回流；部分失败从 owning checkpoint 恢复，已经成功的不可逆步骤不得重做。

`AUTOMATION_INTERVENTIONS` 按 `owning entry/prewarm` 至终态的 owner 外人工动作按根因计数，目标为 `0`；初始 dispatch、准备、只读观察和 owner 自动重试不计。非零时逐项报告介入点、根因和自动化消除落点，不报主观分数。外部等待只在完成点、风险、失败或需决策时更新，不为未变化状态发心跳。

用户要求“提交”或 `/commit` 只授权当前任务分支精确 stage/commit；明确“合入主干”才安全集成本地 `master` 并推送 `origin/master`，除非用户明确限制本地。任何向远程 `master` 写入的交付或发布在远程完成门后运行 `pnpm release:reconcile:mainline`；仅脚本返回 `LOCAL_MAINLINE_SYNCED` 才报告本地同步，`LOCAL_WORKTREE_RETRYING` 由自动 owner 继续，不留用户手工处理。禁止通过 rebase/stash/reset 活跃工作区强行闭合。

## 独立托管应用：按产物确定发布范围

部署前沿真实服务链路确认静态资源、Worker／服务端和容器各自的产物 owner，以本次 diff 和依赖影响选择入口，不能因为存在通用 deploy 脚本就默认全量构建。

| 变化 | 发布范围 |
| --- | --- |
| 浏览器组件、样式、静态内容；服务端合同不变 | 构建并发布前端产物及宿主要求的 Worker，保留现有后端／容器身份；不得顺带构建、推送或 rollout 镜像 |
| Worker 路由、鉴权、API、绑定或配置 | 发布 Worker 并验证与现有后端的兼容性；只有容器也受影响时才发布镜像 |
| runner、容器依赖、镜像、容器配置或 runtime 合同 | 执行该服务的完整部署与对应真实链路验证 |

混合变化取必要产物的并集；影响面未知先调查，不能以全量发布代替判断。服务端渲染或前后端共用一个镜像的应用不适用“前端免镜像”，按实际产物依赖处理。

使用工具官方保留线上后端配置的路径，不通过删除容器绑定、生成平行配置或固定旧镜像副本规避构建。缺少现有部署、元数据不可恢复或兼容性不成立时停止该精简路径，返回调查，不静默切回全量部署。

发布记录包含冻结 SHA、所选入口与范围依据、发布前后资源身份及线上验收。前端部署核对实际 JS／CSS／静态文件和真实页面；声明保留容器时必须比较部署前后镜像身份，不能仅凭命令成功判断。恢复先核对已完成步骤，再从 owner checkpoint 继续，避免重复发布。

Bibo 的具体命令、工具版本和适用边界由 [Bibo Build and deploy](../../../../../../apps/bibo-hosted/README.md#build-and-deploy) 与 package scripts 维护；本合同不复制服务配置或镜像引用。
