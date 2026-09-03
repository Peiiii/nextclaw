# 移除项目 Marker 观测链执行计划

上位设计：[移除项目 Marker 观测链](../designs/2026-09-03-remove-project-markers.design.md)

## 目标与范围

删除 `nextclaw.project/v1` 的 producer、parser、projection 和 UI consumer，同时保留项目文件、上下文、Skills 与 session summary 观测。并完成本轮已确认的工作项状态分组去卡片化。

## 执行部分

### 1. 收敛 kernel 与公共合同

- owner：`packages/nextclaw-kernel/src/features/projects`
- 输入：现有 observation service、config parser、Marker parser/projection 与 snapshot types
- 结果：session observation 只读摘要；Marker 专属实现和字段删除；旧配置字段不再属于合法 schema
- 验证：kernel 定向测试、kernel TypeScript 检查
- 设计策略：复用上位设计

### 2. 删除 UI 与 SDK 残留

- owner：client SDK、server export、Projects UI
- 输入：收敛后的 observation snapshot
- 结果：删除 Marker request/response consumer 和旧类型导出；保留现有非 Marker 页面
- 验证：SDK、server、Projects UI 定向测试与 TypeScript 检查
- 设计策略：复用上位设计

### 3. 删除生成入口并同步用户说明

- owner：内置 Agent Skill 清单、Projects 用户文档、changeset
- 输入：新主链路
- 结果：不再教 AI 创建 Marker；中英文文档说明历史 Marker 不再解析；记录用户可见修复
- 验证：定向文本检索、文档/skill 相关测试与治理检查
- 设计策略：复用上位设计

### 4. 完成视觉调整与统一收尾

- owner：Projects UI
- 输入：本轮已实现的状态分组去卡片样式
- 结果：列表和看板的状态分组均无外层卡片，工作项卡片、折叠与滚动保持正常
- 验证：Projects UI 测试、TypeScript、可见 DOM/CSS 或页面截图、diff-only maintainability review
- 设计策略：沿用用户确认的 Linear 式简约层级

## 恢复入口

中断后从本文件首个未完成部分继续，并先用 `git diff --stat` 与 `rg 'nextclaw\.project/v1|PROJECT_MARKER_INVALID'` 对账。任何仍在运行时 producer、parser 或 consumer 中的命中都视为未完成；历史设计与迭代记录中的事实引用不作为运行时残留。
