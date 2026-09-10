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

## 处理与回复

维护者先准备权限为 `0600` 的维护 token 文件和用于修复的工作目录。推荐 Codex Desktop 时只需配置一次并启动：

```bash
nextclaw feedback maintain configure --workspace /path/to/project --token-file /path/to/token --preset codex-desktop
nextclaw feedback maintain start
nextclaw feedback maintain status
```

管理员批准后，普通代码轮询器才唤醒消费者；空扫描不调用模型。Codex Desktop 预设会以配置的工作目录运行，并在 **Tasks** 中创建“反馈：[项目目录] <反馈标题>”任务，便于按项目搜索和管理；同一反馈的后续用户消息继续进入同一任务。Codex 当前公开的 App Server 协议没有桌面端项目归属参数，因此 NextClaw 不修改 Codex 私有状态来伪造归属。需要原生项目分组时，可以用通用命令入口接入具备该能力的宿主。Codex 读取随包 skill，并自行通过 `maintain get/claim/comment/result` 读取、领取和回写原反馈。进程退出不等于修复完成，平台状态才是业务事实。

监听器不感知消费者是不是 AI。要接入其他 Agent、队列或普通程序，把可信参数数组放在 `--` 后；它会通过 stdin 和 `NEXTCLAW_FEEDBACK_*` 环境变量传递反馈 ID、事件 ID、标题、revision、endpoint 和 skill 路径，不执行 shell：

```bash
nextclaw feedback maintain configure --token-file /path/to/token -- /path/to/consumer --fixed-arg
nextclaw feedback maintain restart
```

通用监听配置不保存或传递工作目录；消费者需要目录时，把它写进自己的参数或脚本。

运行 `nextclaw feedback maintain stop` 停止监听。首次修复必须经过管理员审批；已进入维护链路的用户补充可以唤醒同一任务，但会撤销旧审批，重新修复前仍需管理员再次批准。

管理员在现有管理平台的“用户反馈”中评审，沿用原管理员登录；无需输入另一套反馈管理凭据。

评审工作台默认显示待评审事项，可按状态切换、搜索标题或编号，并分页浏览。选中一条阅读详情后，可直接批准修复或要求补充；处理成功后继续下一条。发布在“待发布”中单独确认。筛选条件在刷新后保留。

反馈可能处于已收到、待补充、待判断、处理中、待发布或已发布。问题严重程度优先于登录状态。AI 先分类并提出建议，管理员批准后才开始自动修复；发布是否自动执行取决于管理员批准的范围。你补充新的复现信息后，需要重新评审。

“待发布”表示已有修复产物，并不表示你的安装已经更新。“已发布”会注明版本和 NPM、Runtime 或 Desktop 渠道。你可以请 AI 查询反馈，再决定是否更新；系统不会因为你提交反馈就自动升级你的环境。

如果新版本仍有问题，继续回复原反馈即可重新进入处理。执行 `nextclaw feedback withdraw <反馈编号>` 可撤回，维护者将停止对该单发起新处理，已经发生的发布不会被撤销。

开发验收服务可以用所有反馈命令的 `--endpoint http://127.0.0.1:3197` 指定。CLI 不会向自定义地址发送平台凭据。此版本代码需部署反馈服务后才能启用正式入口；本地验收地址不代表线上已上线。
