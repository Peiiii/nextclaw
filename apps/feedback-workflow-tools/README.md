# 反馈工作流工具

私有 workspace package，只保留反馈平台验收与发行批次核验，不发布 NPM。通用事件监听由公开的 `nextclaw discussion listen configure/start/status/stop/restart` 命令承载；反馈处理动作使用 `nextclaw feedback workflow`。

```sh
pnpm --filter @nextclaw/feedback-workflow-tools test
pnpm --filter @nextclaw/feedback-workflow-tools lint
```

本地平台验收可运行 `pnpm --filter @nextclaw/feedback-workflow-tools test:platform`，需要先启动 3197 反馈服务、8787 平台 API 及 5177 管理端，并准备 `.local/feedback-acceptance/platform-account.json` 与参与凭据。此命令创建隔离验收反馈并检查真实管理员审批与撤销，不属于常驻运行入口。

监听配置、普通代码轮询、任意消费命令以及 Codex Desktop 预设均属于 `nextclaw` 包，避免私有工具形成第二套生命周期和状态 owner。工作区须干净且隔离；管理员审批、参与端权限和发布证明仍由平台校验。

发布协作保留 `check-batch`、`dispatch-batch`、`reconcile-batch` 子动作，复用原发布 workflow 及平台证明校验；需要配置 githubRepository，显式 allowRelease 才允许 dispatch。修复批准不授权提交或发布。

`reconcile-batch` 只返回已核验的发行信息和报告映射，不调用反馈写接口。Codex 读取最新报告后，通过 `feedback workflow authorize-delivery/publish` 提供真实 SHA、发行证明及自己的回复；平台再次校验，工具成功不代表报告已经回评。
