# 外部 MCP 连接执行计划

> 上位设计：[外部 MCP 连接设计](../designs/2026-08-27-external-mcp-connection.design.md)。

## 目标

让用户可在 NextClaw MCP 页面测试并保存任意外部 stdio、HTTP 或 SSE MCP Server，不依赖 Marketplace 目录。

## 执行部分

1. **共享合同与唯一 mutation 主链**：在 `@nextclaw/mcp` 补一个从 UI 请求构建手动 definition 的纯函数及定向单测；Server 侧建立 `/api/mcp/servers/test`、`POST /api/mcp/servers`，复用 `McpRegistryService` 与 `McpMutationService`。验证：HTTP 路由测试覆盖三种 transport、测试无写入、成功保存、重名及无效输入。
2. **Client SDK 与 UI 表单**：为 client SDK 增加 MCP connection service；在既有 MCP Marketplace 页面增加“连接外部 MCP”右侧抽屉与 `stdio`、`http`、`sse` 表单，固定标题和操作栏、仅滚动字段区。验证：组件测试覆盖 transport 切换、测试失败、测试成功后可保存、风险提示和请求映射。
3. **已有列表与文案**：让手动来源在现有已连接卡片中获得可辨识标签和不回显敏感字段的详情；补齐中英文 i18n。验证：页面测试覆盖手动项与目录项共存及现有管理动作不回归。
4. **文档与集成验证**：补充中文、英文 MCP 指南中的 GUI 与 CLI/Agent 路径；运行相应单测、affected TypeScript check、前端构建与定向浏览器/DOM 检查。验证失败时按失败 owner 返回实现，不新增兼容路径。

## 恢复入口

每部分独立可重跑。若实现中发现现有 `McpServerDefinition` 不能表达任一首版 transport，先回到上位设计更新合同；若只是路由、映射或展示偏差，直接在当前部分修复。未提交的用户构建产物不在本计划范围。

## 交付边界

本次只完成工作区产物与验证；不提交、推送、发布或重启运行中的 NextClaw 实例。
