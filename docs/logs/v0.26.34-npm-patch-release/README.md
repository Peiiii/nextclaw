# NextClaw v0.27.6 NPM patch 正式发布

## 迭代完成说明

本轮将当前已提交的五类用户可见变化统一发布为 `nextclaw@0.27.6` stable patch：

- Codex 与 Claude Code Agent Runtime 保留原生指令，同时获得 NextClaw 产品、工作区与 skill 上下文；
- Panel App 与 HTML 内容支持结构化运行参数；
- 排队消息只在真正开始执行后进入会话记录；
- Mermaid 图表支持全屏预览；
- Agent 会在比较、流程、层级和数值关系适合时更主动地使用表格或 Mermaid。

发布范围采用完整的 49 个公开 workspace 包 patch 批次，确保顶层 `nextclaw`、内嵌 UI 和 runtime 依赖闭包版本一致。

主工作区中未提交的“项目上下文引用”改动不属于本次已审计发布范围，已通过隔离发布工作树完整保留。

## 测试/验证/验收方式

- `pnpm release:report:health`：发布前仓库健康，批次外无 Registry 漂移，workspace 版本不落后于稳定标签。
- `pnpm release:auto:changeset -- --check`：确认已有用户 changeset 覆盖 15 个受影响公开包。
- `pnpm release:auto:changeset`：为其余 34 个公开包生成完整 patch 批次。
- `pnpm release:version`：完成 49 个公开包版本与 changelog 更新，`nextclaw` 版本为 `0.27.6`。
- 发布前 build、TypeScript、lint、governance、Registry pack 与 runtime key 检查：待执行。
- 发布后 Registry、隔离安装、旧版 check/download/apply、新进程版本、公开 docs 与 manifest：待执行。

## 发布/部署方式

- NPM：待通过仓库 `pnpm release:publish` 流程发布。
- GitHub：待推送本地主干、版本标签并创建或更新 `nextclaw@0.27.6` stable Release。
- Stable runtime：待通过 `pnpm release:stable:runtime -- --version 0.27.6 --release-tag nextclaw@0.27.6` 发布。
- Docs：中英文更新说明与结构化 JSON 已准备，待主干部署并验证公开 URL。
- 数据库 migration、后端服务部署和 Desktop installer：不适用；本次没有数据库、远程后端或桌面安装包发布。

## 用户/产品视角的验收步骤

1. 从旧版 NPM 安装态检查 stable 更新，确认发现 `0.27.6`。
2. 下载并应用更新，确认新进程报告 `0.27.6`。
3. 在 Codex 或 Claude Code Runtime 中确认原生行为保留，并能使用 NextClaw 工作区和 skill 上下文。
4. 打开带参数的 Panel App 或 HTML 内容，确认页面能读取 `window.nextclaw.params`。
5. 在聊天中放大 Mermaid 图表，并通过按钮、遮罩和 Escape 退出。
6. 在 AI 回复期间继续发送消息，确认待发内容不会同时出现在聊天时间线中。

## 可维护性总结汇总

- 本轮发布元数据沿用 Changesets、docs notes、结构化 release notes JSON、GitHub Release 和 stable runtime 的既有单一路径，没有新增发布 owner。
- 完整公开包批次由现有 release scope 脚本生成；产品变化的可维护性结论沿用各功能迭代记录。
- 发布阶段只新增文档、JSON、changelog 和版本元数据，不修改产品源码；代码净增门槛不适用于机械发布元数据。
- `post-edit-maintainability-review` 对发布元数据不适用；发布前仍会运行 governance 与生成产物清洁检查。

## NPM 包发布记录

- 发布范围：49 个公开 workspace 包，统一 patch。
- 顶层包：`nextclaw@0.27.6`，目标 dist-tag 为 `latest`。
- 当前状态：版本文件和 changelog 已生成，Registry 发布、标签、GitHub Release 与 stable runtime 待闭合。
- 精确包版本、Registry 验证结果和 workflow URL 将在发布完成后补充。
