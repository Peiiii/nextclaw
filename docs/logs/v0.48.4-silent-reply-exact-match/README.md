# 2026-09-04 v0.48.4-silent-reply-exact-match

## 迭代完成说明

- 修复正常 assistant 回复只因正文提到 `<noreply/>` 就从聊天时间线消失的问题。
- 根因是 shared 静默回复判定使用无边界的子串正则；消息已经由后端完整持久化，但 UI 水合后复用该判定将整条消息过滤，因此会话概览能看到新回复、消息列表却看不到。
- 通过原故障会话的 API 数据确认：最终 assistant 消息存在且包含 19 个 part，普通说明文字中提到了静默标记。修复直接收紧唯一 shared owner：只有全部可见文本规范化后整体匹配 `<noreply/>` 才静默，普通正文中的提及继续显示。
- 为兼容已经持久化的历史静默消息，仍接受标记两侧的真实空白和字面量 `\\n`、`\\r`、`\\t`，不恢复任意子串匹配。
- 同步修正 kernel 系统提示、用户文档和功能宇宙说明，消除“整条回复必须是标记”与“任意位置出现都静默”的合同冲突。

## 测试/验证/验收方式

- shared、core、kernel、UI 四组定向 Vitest：4 个文件、17 项测试全部通过。
- `@nextclaw/shared`、`@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/ui` 的 `tsc --noEmit` 全部通过。
- 受影响依赖闭包及 UI production build 通过；触达文件定向 ESLint、`lint:new-code:governance`、`check:governance-backlog-ratchet`、`git diff --check` 全部通过。
- 使用新构建的 shared 产物回放真实会话 `ncp-mtln3ih3-426zjbv2` 的最终消息 `assistant-message-aa564a2b-f660-4518-8309-74bd2cbbc19c`，判定结果为 `silent: false`。

## 发布/部署方式

- 本批次只提交并合入 `master`，未发布 NPM、runtime 或桌面安装包，也未重启当前 NextClaw 实例。
- 用户将在包含本 changeset 的后续稳定版本安装或更新后获得修复。

## 用户/产品视角的验收步骤

1. 让 AI 在一条正常回复中解释或引用 `<noreply/>`，确认完整回复仍显示在聊天消息列表。
2. 让 AI 的全部可见回复仅为 `<noreply/>`，确认该回复保持静默。
3. 刷新会话，确认上述两类消息的可见性与刷新前一致，且会话概览与消息列表不再互相矛盾。

## 可维护性总结汇总

- 保留 `packages/nextclaw-shared` 为静默判定唯一 owner，core 与 UI 继续复用，没有新增并行判断或 fallback。
- 生产代码净增仅用于组合整条可见文本和精确边界；没有改变 React 组件类型、列表 key、消息排序、持久化或流式生命周期。
- 新增的 core 边界测试与 shared/UI 现有测试分别保护传输丢弃和时间线可见性，避免只修表象。
- diff-only maintainability 检查无错误；唯一警告是 kernel provider 目录已有且已记录的数量例外，本次没有新增 provider 文件或扩大该债务。
- 文件命名、角色边界、公共包导入与治理 backlog ratchet 均通过。

## NPM 包发布记录

- 本次需要后续随稳定发布更新 `@nextclaw/shared`、`@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/ui`，均已添加 patch changeset，当前状态为 `待统一发布`。
- 本轮不涉及 NPM 包发布。
