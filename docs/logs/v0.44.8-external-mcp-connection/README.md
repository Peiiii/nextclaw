# 外部 MCP 连接

## 迭代完成说明

MCP 页面此前只能安装 Marketplace 目录中的项目，不能连接用户已有或第三方 MCP Server。本次增加外部 MCP 接入：支持 stdio、HTTP、SSE，保存前测试工具发现，保存后通过既有配置热加载生效，并在已安装列表中统一管理。

连接表单改为右侧抽屉，标题和操作栏固定，字段区独立滚动。CLI 已有的 `nextclaw mcp add/list/doctor/enable/disable/remove` 与 UI 使用同一份 MCP 配置合同，Agent 可通过这些命令完成配置和管理。

## 测试/验证/验收方式

- Server 路由测试覆盖测试不写入配置、保存与热重载、无效输入，以及真实 stdio MCP 工具发现。
- UI 定向测试覆盖成功测试后才允许保存；`@nextclaw/ui` TypeScript 和定向 ESLint 通过。
- 本地页面检查确认抽屉外层高度等于视口且不滚动，表单字段区 `overflow-y: auto`，固定操作栏持续可见。
- CLI 隔离配置冒烟通过 `add -> list -> doctor (toolCount=1) -> remove -> list`。

## 发布/部署方式

本次仅提交源码、文档、changeset 与验证记录；不发布、不部署。后续按常规 Changesets 流程发布 `@nextclaw/client-sdk`、`@nextclaw/server` 与 `@nextclaw/ui`。

## 用户/产品视角的验收步骤

1. 打开设置中的 MCP 页面，点击“连接外部 MCP”。
2. 填写一个 stdio、HTTP 或 SSE 服务，点击“测试连接”，确认显示工具数量。
3. 保存后在已安装 MCP 中确认条目；执行诊断、停用、启用和移除。
4. 使用 `nextclaw mcp add` 添加另一个服务，确认它同样出现在已安装列表并可被管理。

## 可维护性总结汇总

复用现有 `McpMutationService`、`McpRegistryService`、配置事件和 Sheet primitive，没有新增平行配置存储、UI 基础组件或 CLI 语义。定向 maintainability 检查无 findings；跨层边界保持为 UI/SDK -> Server -> MCP owner。

## NPM 包发布记录

不涉及 NPM 包发布；changeset 已准备，待后续统一发布。
