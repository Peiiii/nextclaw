# 反馈维护应用

私有 workspace package，负责用代码发现已批准的反馈并唤醒 Codex。不发布 NPM，不依赖仓库 scripts 作为运行时。

```sh
pnpm --filter @nextclaw/feedback-maintainer start /absolute/path/config.json
pnpm --filter @nextclaw/feedback-maintainer test
pnpm --filter @nextclaw/feedback-maintainer lint
```

本地平台验收可运行 `pnpm --filter @nextclaw/feedback-maintainer test:platform`，需要先启动3197反馈服务、8787平台API及5177管理端，并准备 `.local/feedback-acceptance/platform-account.json` 与维护凭据。此命令创建隔离验收反馈并检查真实管理员审批与撤销，不属于常驻运行入口。

配置示例（凭据文件由维护者保管，相对路径相对配置文件）：

```json
{
  "endpoint": "https://roadmap.nextclaw.io",
  "tokenFile": "maintainer-token",
  "workspace": "/path/to/clean-repair-worktree",
  "allowedPaths": ["apps/example/src/"],
  "intervalMs": 30000,
  "timeoutMs": 600000
}
```

运行环境需提供已认证的 Codex 和支持 `feedback maintain` 的 NextClaw。默认CLI为 `nextclaw`；未发布构建可通过 `cliCommand` 参数数组指定实际构建入口。启动时通过 `feedback maintain skill-path` 获取包内skill的绝对路径，不注入整个文档，不拼接报告正文执行shell。维护token传给子进程，管理员凭据不传入。

扫描器只读取队列并持久化提醒标识；相同反馈版本及审批只提醒一次，空扫描不调用模型。Codex通过CLI自行领取、评论、验证和回写，退出码不代表业务完成。SIGTERM终止执行进程组，但不伪造反馈结果。异常启动不自动重跑；确认旧执行已停止后通过维护CLI恢复、管理员重新批准。提醒记录默认保存在配置同目录的dispatch，可用stateDirectory指定。

工作区须干净且隔离；修复保留供检查，不自动重置。允许路径是维护指令及发布成果校验范围，不是操作系统级私密文件读取隔离。仅用于管理员审阅后的受控维护，不能据此声称陌生输入可以全权限无人值守。

发布协作保留 `check-batch`、`dispatch-batch`、`reconcile-batch` 子动作，复用原发布workflow及平台证明校验；需要配置githubRepository，显式allowRelease才允许dispatch。修复批准不授权提交或发布。

`reconcile-batch` 只返回已核验的发行信息和报告映射，不调用反馈写接口。Codex 读取最新报告后，通过 `feedback maintain authorize-delivery/publish` 提供真实 SHA、发行证明及自己的回复；平台再次校验，工具成功不代表报告已经回评。
