# v0.26.24 Agent Runtime 模型偏好恢复

## 迭代完成说明

- 修复全新任务中切换 Agent Runtime 后，当前模型仍可能沿用上一 Runtime 选择的问题。
- 根因是会话偏好同步只把 `sessionKey` 作为上下文身份；草稿会话切换 Runtime 时 `sessionKey` 始终为空，因此没有重新应用对应 Runtime 的模型偏好。
- 偏好上下文现由 `sessionType + sessionKey` 共同标识。草稿切换 Runtime 时会重新按以下顺序选模：
  1. 用户最近为该 Runtime 明确选择的模型；
  2. 最近同类型会话记录的模型；
  3. Runtime 推荐模型；
  4. 全局默认模型；
  5. 第一个可用模型。
- 已有会话仍以该会话保存的模型为最高优先级，未改变会话恢复语义。
- 同时删除未被使用的 `setSelectedModel` 输入动作，保持生产语义代码净增长为零。

## 测试/验证/验收方式

- 修复前先补回归用例并确认失败：草稿从 Native 切到 Codex 时，实际错误地保留 Native 当前模型。
- 定向测试通过：会话输入状态、会话区域装配、Runtime 最近选择存储、NCP Chat 页面与会话类型状态共 `53` 个测试。
- `pnpm -C packages/nextclaw-ui tsc --noEmit` 通过。
- `pnpm -C packages/nextclaw-ui lint` 通过。
- `pnpm -C packages/nextclaw-ui build` 通过；仅有既有 Browserslist 数据过期与 chunk size 提示。
- 在隔离源码实例 `http://127.0.0.1:18889` 做浏览器真实验收：
  - Native 选择 `DeepSeek/deepseek-v4-flash`；
  - Codex 选择 `codex-sub/gpt-5.4`；
  - 在同一全新草稿中来回切换，两种 Runtime 均自动恢复各自最近模型；
  - 浏览器控制台无错误。
- 全量 UI 测试共 `177` 个测试文件，其中 `172` 个通过、`5` 个失败；失败集中在既有测试漂移（QueryClient 测试装配、旧 `createSession` 参数断言、Workspace Panel 旧文案与旧 query key），与本次模型偏好改动无关。相关定向测试全部通过。

## 发布/部署方式

- 功能提交：`cf539fe37`。
- 已随稳定 NPM patch 批次发布 `@nextclaw/ui@0.15.18`。
- 本批不包含顶层 `nextclaw`、runtime update channel、桌面安装包、数据库 migration 或独立后端部署。
- 浏览器验收使用当前源码构建的隔离运行实例；验收后已停止。
- 未重启或修改用户正在运行的 NextClaw 实例。

## 用户/产品视角的验收步骤

1. 打开一个全新任务，选择 Native，并选择模型 A。
2. 切换到 Codex，选择不同的模型 B。
3. 切回 Native，确认模型自动恢复为 A。
4. 再切回 Codex，确认模型自动恢复为 B。
5. 选择一个此前从未选过模型的 Runtime，确认优先显示该 Runtime 推荐模型；若没有推荐模型，则显示全局默认模型。
6. 打开已有会话，确认仍优先恢复该会话保存的模型。

## 可维护性总结汇总

- 模型偏好的事实 owner 仍是现有按 Runtime namespace 持久化的最近选择管理器，没有新增第二套存储或兼容分支。
- 修复落在偏好同步的上下文身份上，使 Runtime 切换和会话切换走同一条标准解析链路。
- 生产代码新增 `13` 行、删除 `13` 行，净增长 `0`；测试新增 `70` 行、删除 `3` 行。
- 新增状态层与装配边界两层回归测试，防止后续只验证 resolver、却漏掉 React effect 依赖和参数透传。
- maintainability guard 为 `0` 个错误、`1` 个提醒：`session-conversation-area.tsx` 当前 `413` 行，接近 `500` 行预算；本次只增加两行必要装配，不为局部接线额外制造抽象。

## NPM 包发布记录

- 受影响包：`@nextclaw/ui`
- 发布版本：`0.15.18`
- dist-tag：`latest`
- 原 changeset 已由版本化流程消费。
- registry 与隔离安装验证均已通过；完整批次记录见 `docs/logs/v0.26.25-ui-ncp-react-patch-release/README.md`。
