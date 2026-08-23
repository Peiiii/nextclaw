# 会话历史结构保真与压缩边界修复

## 迭代完成说明

- 根因：历史摘要接口原先只保留一个工具调用，删除同一 assistant message 后续的 `tool-invocation` parts；checkpoint 的 `coveredPartCount` 基于完整消息，而 UI 时间线基于裁剪后的摘要消息定位，导致压缩线和 Continue 后新增内容可能错位。
- 确认方式：对服务端 summary/full API、checkpoint 元数据、前端 timeline projector 和 NCP adapter 逐段核对；真实会话中 summary/full 的 assistant parts 数量在修复后完全一致，`coveredPartCount` 67 和 46 均落在结构范围内。
- 修复：摘要保留所有 part 的数量和顺序，仅清空工具大 payload，并标记 deferred 节点；时间线继续使用结构骨架定位，UI adapter 只隐藏 deferred 工具卡片。
- 本轮另行发现的 Observation 事件 `extensionId: "unknown"` 是后端 delivery 反查订阅失败后的数据兜底问题，尚未在本提交中修改。

## 测试/验证/验收方式

- Server 定向测试 12/12 通过；UI 相关定向测试 21/21 通过。
- NCP、Server、UI TypeScript 检查通过；相关 ESLint 通过。
- 真实会话 API 验证 summary/full 消息数量和 assistant parts 数量一致，保留了摘要 payload 优化。
- UI 全量测试 223 个文件通过，12 个既有无关测试文件失败，共 41 个失败用例，集中在设置、渠道、项目弹窗和 Provider 测试环境。
- diff-only maintainability 检查 0 errors、1 个既有文件预算 warning；`git diff --check` 通过。

## 发布/部署方式

- 本次只执行本地 commit，不 push、不创建 PR、不发布、不部署、不重启宿主。
- 已添加 `.changeset/chat-history-structural-fidelity.md`，待后续统一版本发布时消费。

## 用户/产品视角的验收步骤

1. 打开会话 `sid_bmNwLW10NXBpOG5nLTc0dWY0eHk0`，确认上下文压缩线前是压缩前内容。
2. 触发或查看 Continue 后的 assistant 内容，确认新内容位于压缩线之后。
3. 刷新会话，确认冷加载与当前时间线的压缩边界位置一致。
4. 确认工具调用摘要仍然轻量，不会因为保留结构骨架而展开所有工具详情。

## 可维护性总结汇总

- 修复直接落在历史摘要 owner，删除了结构裁剪造成的隐式 offset 依赖，没有新增第二套时间线排序或映射器。
- NCP message 类型明确表达 deferred payload；服务端负责裁剪详情，UI adapter 负责展示过滤，owner 边界清晰。
- 本次新增代码没有扩大文件/模块层级；自动维护性检查无 error，仅报告 `ncp-session-adapter.utils.ts` 接近既有预算。
- 文件组织 preflight、文件名检查和目录命名检查通过；`types/message.ts` 的既有文件角色命名债务在触达时被治理检查识别，但本次没有扩大范围重命名。

## NPM 包发布记录

不涉及 NPM 包发布；`@nextclaw/ncp`、`@nextclaw/server`、`@nextclaw/ui` 的 changeset 待统一发布。
