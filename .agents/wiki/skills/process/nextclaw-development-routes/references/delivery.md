# NextClaw 交付合同

发布按项目命令语义：清晰自然语言与 `commands/commands.md` 的命中条目等价；“发布 NPM”只进入 NPM package owner，“发布 NextClaw 正式版”包含 NPM 与常规 runtime/product closure，“桌面版”或“全平台版”才授权 desktop。release/deploy 使用[任务遥测方法](../../development-task-telemetry/SKILL.md)记录阶段、耗时、等待、重试和人工边界；结束时按现有发布合同报告 `AUTOMATION_INTERVENTIONS: <n>`。单次 dispatch 后冻结 identity/protocol，按 checkpoint 幂等恢复，不让用户或 Agent 人工拼版本、SHA、阶段参数。

公开内容候选仅在 Validation/Review 已形成稳定证据，且成果明显改变用户任务、有可解释 before/after、解决可复用 AI 原生问题或有真实指标/界面时进入博客 owner；常规修复、内部重构、纯 changeset 和证据未稳定时跳过。命中不等于授权发布，上线、导航、配图和社交各守自己的边界。发布终态必须覆盖适用 artifact、manifest、update channel、release notes、部署后 smoke 与分支回流；部分失败从 owning checkpoint 恢复，已经成功的不可逆步骤不得重做。

`AUTOMATION_INTERVENTIONS` 按 `owning entry/prewarm` 至终态的 owner 外人工动作按根因计数，目标为 `0`；初始 dispatch、准备、只读观察和 owner 自动重试不计。非零时逐项报告介入点、根因和自动化消除落点，不报主观分数。外部等待只在完成点、风险、失败或需决策时更新，不为未变化状态发心跳。

用户要求“提交”或 `/commit` 只授权当前任务分支精确 stage/commit；明确“合入主干”才安全集成本地 `master` 并推送 `origin/master`，除非用户明确限制本地。任何向远程 `master` 写入的交付或发布在远程完成门后运行 `pnpm release:reconcile:mainline`；仅脚本返回 `LOCAL_MAINLINE_SYNCED` 才报告本地同步，`LOCAL_WORKTREE_RETRYING` 由自动 owner 继续，不留用户手工处理。禁止通过 rebase/stash/reset 活跃工作区强行闭合。
