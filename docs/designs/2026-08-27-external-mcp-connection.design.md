# 外部 MCP 连接设计

## 背景与目标

当前 MCP 页面是 Marketplace 目录：线上目录仅有 Chrome DevTools MCP，页面只能从目录模板安装、启停、诊断和移除。用户不能把自己或第三方提供的 MCP Server 直接接入 NextClaw。

本设计补齐一个可观察的闭环：用户从 MCP 页面选择“连接外部 MCP”，填写本地或远程 Server 的必要信息，先测试工具发现，确认信任后保存；已连接 Server 与 Marketplace 安装项在同一列表中管理。

这增强 NextClaw 作为统一入口连接外部软件与服务的能力；MCP Marketplace 继续承担发现和一键安装，不被用作通用连接配置的替代品。

## 范围

- 支持手动接入 `stdio`、`http`、`sse` 三种已有 transport。
- `stdio` 配置名称、命令、参数、工作目录、环境变量和 stderr 处理。
- `http` / `sse` 配置名称、URL、Headers、超时与 TLS 校验。
- 保存前测试连接并展示发现到的工具数或可读错误；保存后热应用配置。
- 在现有“已安装 MCP”列表中显示手动接入项，并复用现有启停、诊断、移除。

非目标：MCP Marketplace 扩容、OAuth 浏览器授权流、导入第三方客户端配置文件、团队/项目作用域、多租户权限模型、MCP Server 托管与 Service App 改造。

## 用户任务与功能地图

用户从设置中的 MCP 页面进入，为让 Agent 使用一个目录外的工具服务而连接该 Server；测试成功后保存，看到其工具已被发现，并可随时启停、诊断或移除。

| 场景 | 用户看到与执行 | 事实 owner | 失败与恢复 |
| --- | --- | --- | --- |
| 默认 | 目录与“已连接”两个现有视图，新增“连接外部 MCP”主操作 | MCP 页面 | 目录为空不影响手动连接入口 |
| 选择 transport | 本地 `stdio` 或远程 `HTTP` / `SSE`，表单只展示对应字段 | 连接表单局部状态 | 切换 transport 清除不兼容字段，不丢同类字段 |
| 测试 | “测试连接”显示 pending，完成后显示工具数或错误 | 服务端临时 `McpRegistryService` | 失败不写入配置，用户可修改后重试 |
| 保存 | 明确提示 Server 将执行命令或访问远端；确认后保存 | `mcp.servers` + `McpMutationService` | 重名或 schema 校验失败留在表单并显示错误 |
| 管理 | 已连接项与市场项共用启停、诊断、移除 | 现有 installed view / lifecycle | 诊断失败显示上次错误且不删除配置 |
| 刷新 | 已保存项从唯一配置恢复 | `mcp.servers` | 不持久化测试临时状态或明文以外的第二份状态 |

## 方案比较与选择

| 方案 | 结论 |
| --- | --- |
| 扩充 MCP Marketplace 目录 | 不采用。目录数量增加不能让用户接入自建或任意第三方 Server。 |
| 让用户进入通用 JSON 配置页 | 不采用。虽最省代码，但把 transport、密钥与连接错误处理重新交给用户，不符合普通用户的任务。 |
| 在 MCP 页面并列“目录安装 + 手动连接” | 采用。与 Claude、Cursor、VS Code 的成熟分层一致，且复用当前 `mcp.servers`、热重载与诊断主链路。 |

## 结构与主链路

```text
MCP 页面连接表单
  -> POST /api/mcp/servers/test（仅临时定义）
     -> McpRegistryService.warmServer -> tools/list 结果
  -> POST /api/mcp/servers（确认保存）
     -> McpMutationService.addServer
     -> config.updated(path=mcp) -> applyLiveConfigReload
     -> 已连接列表刷新
```

`@nextclaw/mcp` 中的 `McpMutationService` 是唯一的持久化 mutation owner；`McpRegistryService` 是唯一连接与工具发现 owner。Server 的新 MCP controller 只负责 HTTP 输入校验、调用这两个 owner、发布 `config.updated` 及触发既有热重载。Marketplace controller 保持只处理目录 API 与目录模板安装。

手动 Server 的规范持久化形态沿用已有 `McpServerDefinition`，并写入 `metadata.source: "manual"`、`installedAt`。因此 Marketplace 和手动接入项由同一个 `McpInstalledViewService` 投影，不新增手动安装表、状态 store 或 adapter。

## API 合同

新增通用资源路由，避免把非 Marketplace 语义塞进 `/api/marketplace/*`：

- `POST /api/mcp/servers/test`：接收未持久化的 `{ name, definition }`；仅验证并连接，返回 `{ name, transport, accessible, toolCount, error? }`。不写配置。
- `POST /api/mcp/servers`：接收同一形态；服务端覆盖 `metadata.source` 和 `installedAt`，创建成功后发布 `config.updated(mcp)` 并热重载，返回已创建项。

`definition` 使用已有核心 schema：stdio 必须有 command；远程必须有合法 URL；名称由 `McpMutationService` 统一规范化。Headers 与 stdio env 被视为敏感输入：本期保留在既有配置合同中，但 UI 不回显已保存的值；后续与统一 Secrets 引用整合时再替换存储表达，不引入半套密钥系统。

## 交互与安全边界

- MCP 页面顶部保留目录浏览，新增发现性明确的“连接外部 MCP”按钮；不把入口藏在搜索或二级菜单。
- 连接表单使用右侧抽屉：标题与操作栏固定，字段区独立滚动，避免长表单在弹窗中溢出或遮住操作。
- 对本地 `stdio`，保存前显示“该 Server 会在本机执行此命令”；对远程 transport，显示目标地址与“仅连接你信任的 Server”。
- 测试与保存是两个按钮：测试不产生持久化副作用，保存只有在最近一次相同配置测试成功后可用。
- 取消、关闭和测试失败均不写入配置。重新打开页面不恢复未保存表单。
- 已连接卡片用来源标签区分“手动连接”和“Marketplace”，但管理动作保持一致。

## 保留、删除与延后

- 保留：现有 `McpMutationService`、`McpRegistryService`、`McpDoctorFacade`、`McpInstalledViewService`、`config.updated` 和 `applyLiveConfigReload`。
- 删除：无；现有 Marketplace 路径仍是目录安装的唯一入口。
- 延后：OAuth、配置导入、团队共享、项目 scope、工具级 allowlist、批量导入、远程目录聚合。这些没有当前用户路径或 owner 证据，不能以“可扩展”为由进入首版。

## 验收标准

1. 用户可从 MCP 页面新建 stdio、HTTP、SSE 外部 MCP，且不依赖 Marketplace 目录。
2. 无效 transport 配置不能保存；测试失败不会改写 `mcp.servers`。
3. 测试成功返回正确的工具数；保存后配置具备 `manual` 来源且热重载发生。
4. 手动项和 Marketplace 项在同一已连接视图中都可启停、诊断、移除。
5. 前端具备可达的表单、pending/success/error 状态和明确的本地执行/远程连接风险说明。
6. CLI 与 UI 使用同一 MCP 配置合同；Agent 可用 `nextclaw mcp add/list/doctor/enable/disable/remove` 完成同等管理操作。

## Design Ready

设计文档：required。执行计划：required；原因是实现跨 UI、client SDK、HTTP 资源、MCP owner、配置热重载和用户文档，且验证存在顺序依赖。
