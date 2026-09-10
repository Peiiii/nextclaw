# 反馈问题与跟踪修复

你可以让 NextClaw 中的 AI 帮你报告问题，也可以在反馈门户的“反馈问题”页面自行提交。无需注册或登录 GitHub；新反馈仅你和维护者可见。

告诉 AI：“帮我反馈刚才的问题，附上复现步骤。”它可以用 `nextclaw feedback submit` 提交描述、版本和运行环境。发送前应检查内容，不要附带密钥、密码、完整会话或无关个人信息。

```bash
nextclaw feedback submit --title "工具运行失败" --description "复现步骤、实际结果和期望结果" --affected-version "受影响的版本"
nextclaw feedback list
nextclaw feedback get <反馈编号>
nextclaw feedback reply <反馈编号> "补充复现步骤"
```

命令返回 JSON，回执自动保存在本机。提交失败时，错误中会显示已保存的请求编号；使用原参数加 `--request-id <编号>` 重试，会继续同一条反馈。

## 让 AI 查询和管理反馈

你可以说：“看看我上次反馈的问题处理到哪了。”AI 会查询本地保存的反馈及维护者回复；也可以帮你补充复现信息或撤回反馈。无需打开表单或复制反馈编号，不会默认创建消耗模型额度的定时查询任务。

维护端使用普通代码检查已批准事项，没有可执行事项时不调用模型。处理结果写回原反馈，供你或 AI 查询。“待发布”不代表已发布，也不会自动升级你的环境。主动通知不是提交反馈时默认开启的能力。

## 匿名回执与账号

匿名用户凭回执查看和补充自己的反馈。网页回执保存在当前浏览器，CLI 回执保存在 NextClaw 数据目录；两者可以通过回执文件相互恢复。回执包含私密访问权限，请妥善保管，不要贴到公开讨论里。

```bash
nextclaw feedback export <反馈编号> receipt.json
nextclaw feedback import receipt.json
```

已登录 NextClaw 的 CLI 会自动携带现有平台身份，由服务端核验；凭据过期时仍可匿名提交。稍后登录后执行 `nextclaw feedback link <反馈编号>`，可将已有回执关联到账号；`nextclaw feedback sync` 找回账号下的反馈。独立反馈网页使用匿名回执；如需关联已有 NextClaw 登录，可将网页回执导入 CLI 后关联，不需要再登录另一个系统。

## 处理、审批与直接对话

管理员仍在原管理平台登录，在“反馈与对话”中完成两类工作：

- “反馈队列”用于分类、要求补充、批准修复和单独批准发布。用户、管理员和处理端的发言显示各自经过服务端确认的身份。
- “直接对话”可由管理员直接创建主题，不需要先有用户反馈，也不需要运行命令行。已订阅的本地参与端会收到主题和后续管理员消息。

本地参与端只需配置一次通用讨论监听器。Codex Desktop 是推荐预设：

```bash
nextclaw discussion listen configure --workspace /path/to/project --token-file /path/to/token --preset codex-desktop
nextclaw discussion listen start
nextclaw discussion listen status
```

监听器是普通代码进程，只读取面向 `participant` 角色的事件游标；没有新事件时不会调用模型。新主题创建 Codex 任务，同一主题的后续消息恢复同一任务。工作目录和 Codex 任务映射只属于 Codex 消费预设，不进入讨论协议。

接入其他 Agent、队列、脚本或普通程序时，直接提供可信参数数组：

```bash
nextclaw discussion listen configure --token-file /path/to/token -- /path/to/consumer --fixed-arg
nextclaw discussion listen restart
```

监听器不识别消费者类型，也不运行 shell。它通过 stdin 和 `NEXTCLAW_DISCUSSION_*` 环境变量提供主题 ID、事件 ID、标题、空间、游标、endpoint 和随包 skill 路径。消费者自行决定如何建立或恢复上下文，并通过 `nextclaw discussion get/post` 读取和回写。运行 `nextclaw discussion listen stop` 可停止监听。

随包的 `discussion-participant` skill 是 AI 的能力索引：监听事件只传 skill 路径，AI 在需要时读取，而不是在每个界面展示入口。AI 收到事件后先在原主题确认已收到，耗时任务可按实际进度继续回帖。`direct` 主题只使用讨论命令；`support` 主题再按 skill 指引使用 `nextclaw feedback workflow get/claim/comment/result`，由反馈应用执行审批、领取、状态和发布约束。

反馈提交本身只通知管理员。管理员批准当前输入版本后，服务才产生面向参与端的事件；用户补充新证据会使旧批准失效并先回到管理员，重新批准后才再次触发处理端。角色定向发生在服务端事件写入时，通用监听器不读取或解释反馈状态。

“待发布”表示已有修复产物，并不表示你的安装已经更新。“已发布”会注明版本和 NPM、Runtime 或 Desktop 渠道。发布需要独立批准和可核验的真实发布证明。问题仍存在时继续回复原反馈；`nextclaw feedback withdraw <反馈编号>` 会停止新的处理。

开发验收服务可以用 `--endpoint http://127.0.0.1:3197` 指定。平台凭据不会发送到自定义地址；讨论参与凭据只用于明确配置的讨论服务。
