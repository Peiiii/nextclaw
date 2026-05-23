# TweetClaw OpenClaw 插件

当你想在 NextClaw 里跑一个具体的 OpenClaw 插件工作流，并处理 X/Twitter 研究与确认后发帖时，可以使用这条路径。

TweetClaw 是面向 Xquik API 的 OpenClaw 插件。它可以 search tweets、search tweet replies、导出 followers、查询用户、monitor tweets、处理 media upload 或 media download、发送 direct messages，并运行 giveaway draws。post tweets 与 post tweet replies 这类写入动作必须先经过人工确认。

## 适用场景

- 你需要 X/Twitter 自动化插件，而不是只靠 prompt 的 Skill
- 你想在 NextClaw 会话里稳定做 tweet search 或 reply search
- 你想在营销或客服工作流前做 follower export 或 user lookup
- 你希望本地和托管环境都能复用同一条 OpenClaw 插件路径

## 安装

在终端安装官方 npm 包：

```bash
nextclaw plugins install @xquik/tweetclaw
```

npm 包是安装来源。可以通过 [TweetClaw GitHub 仓库](https://github.com/Xquik-dev/tweetclaw) 和 [npm package](https://www.npmjs.com/package/@xquik/tweetclaw) 核对当前版本与 README。[ClawHub listing](https://clawhub.ai/plugins/@xquik/tweetclaw) 适合做发现入口。

## 配置凭据

TweetClaw 可以先安装，再配置凭据。凭据只放在本地 secret store 或运行时环境里，不要写进 prompt、Markdown 文件、截图或共享聊天记录。

普通 API 访问使用名为 `XQUIK_API_KEY` 的 Xquik API key。如果你使用 Machine Payments Protocol 调用只读端点，也要把签名 key 放在同一类 secret 边界里。

更新运行时 secret 后，重新加载或重启 NextClaw，让插件进程读取新值。

## 验证

先做只读检查：

```bash
nextclaw plugins list
nextclaw plugins info tweetclaw
```

然后在聊天里跑一个低风险任务：

```text
Use TweetClaw to search tweets about "NextClaw OpenClaw plugin" and return 5 tweet URLs, authors, timestamps, and short relevance notes.
```

研究回复时可以这样说：

```text
Use TweetClaw to search tweet replies for this public tweet URL. Summarize recurring questions, complaints, and useful reply examples. Do not post or send messages.
```

## 审批边界

默认保持只读的动作：

- search tweets
- search tweet replies
- follower export
- user lookup
- media download
- monitor tweets
- webhook review
- giveaway draw inspection

执行前必须得到明确人工确认的动作：

- post tweets
- post tweet replies
- media upload
- direct messages
- webhook creation or delivery changes
- 未经过审查任务边界的大批量 follower export

## 团队工作流

1. 针对活动、客服主题或发布关键词 search tweets 或 tweet replies。
2. 会话里只保存公开 tweet URL、ID、handle、时间戳和审查后的摘要。
3. 让 agent 先把 replies 或 posts 写成草稿。
4. 人工检查文本和目标账号。
5. 草稿确认后，只批准单个写入动作。

## 故障排查

如果插件安装成功但聊天里看不到，运行 `nextclaw plugins list` 并确认插件已启用。如果工具出现了，但 live call 返回设置提示，确认 `XQUIK_API_KEY` 已对 NextClaw runtime 可见，然后重启服务。

如果你只需要任务说明，不需要 live API call，用 Skill 即可。如果你需要实时 X/Twitter 数据，用插件。

## 相关文档

- [Skills 教程](/zh/guide/tutorials/skills)
- [MCP Marketplace](/zh/guide/tutorials/mcp-marketplace)
- [密钥管理](/zh/guide/secrets)
- [命令索引](/zh/guide/commands)
