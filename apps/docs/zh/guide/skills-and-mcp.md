# Skills 与 MCP

Skills 和 MCP 都能扩展 Agent，但解决的问题不同：Skill 让 Agent学会一套做事方法，MCP 则把外部工具或数据源接进来。

![技能市场与右侧文档浏览器](/product-screenshots/nextclaw-skills-doc-browser-cn.png)

## Skills

Skill 可以包含任务步骤、判断标准、工具使用方法和输出要求。适合把已经跑通的重复工作沉淀下来，例如：

- 每周报告的取数、检查和排版规则；
- 某类代码变更的验证清单；
- 文件归档和命名规范；
- 发布前的检查流程。

你可以在技能市场浏览和安装 Skill，也可以让 NextClaw 根据当前流程创建或完善一个 Skill。安装后要先用低风险任务验证，不要因为来源名称熟悉就默认它适合当前环境。

## MCP

MCP 服务可以提供工具、资源和外部系统入口。接入后，先检查连接状态、可用工具和授权范围；出现问题时使用 MCP 检查入口查看错误。

除了从 MCP 市场安装，你也可以在 **设置 → MCP** 中选择“连接外部 MCP”。本地服务填写启动命令和参数；远程服务填写地址、请求头和超时。先测试连接，确认发现的工具后再保存。只连接你信任的服务：本地 MCP 会执行命令，远程 MCP 可能访问外部数据和系统。

命令行和 Agent 也能配置同一批 MCP 服务，不需要绕过界面或手改配置文件。例如：`nextclaw mcp add local-tools -- npx -y <mcp-package>` 添加本地服务；`nextclaw mcp add remote-tools --transport http --url https://example.com/mcp --header Authorization='Bearer <token>'` 添加远程服务。随后使用 `nextclaw mcp doctor <name>` 检查连接和工具，使用 `list`、`enable`、`disable`、`remove` 管理它们。命令与界面共用配置和运行中的热加载结果。

## 如何选择

- 有工具但每次都不知道怎么做：写成 Skill。
- 知道流程但缺少某个系统的操作能力：接入 MCP。
- 一项工作既需要外部工具又有固定标准：MCP 提供动作，Skill 规定用法。

## 面向哪些 Agent

安装时确认能力是仅供当前 Agent 使用，还是对所有 Agent 开放。带有敏感数据访问或高影响操作的工具不应无条件提供给全部 Agent。

相关文档：[Agent 与子任务](/zh/guide/multi-agent) · [工具与操作](/zh/guide/tools)
