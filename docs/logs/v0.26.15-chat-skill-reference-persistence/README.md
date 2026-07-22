# v0.26.15 聊天 Skill 引用显式持久化

## 迭代完成说明

- 根因：skill catalog 已提供 `ref/name/source/path` 完整事实，但消息 metadata 只保存通用 `key`；点击时又依赖当前 session 的临时 catalog 反查路径，导致 workspace 变化、查询未同步或消息重载后可能没有任何反馈。
- 修复方式：将 `ui_inline_tokens` 升级为 schema v2。skill 使用独立的 `ref/name/source/path` 字段，workspace 文件和目录才继续使用 `key`；消息正文显示 `$skill-name`，不暴露 ref 或绝对路径。
- 新消息直接使用消息保存的路径打开 rendered preview；旧数组消息只在点击时使用消息所属 session 的 skill API 做兼容解析，失败、歧义和文件不可用均显示本地化错误。
- 设计依据详见 `docs/designs/2026-07-22-chat-skill-reference-persistence.design.md`。

## 测试/验证/验收方式

- `@nextclaw/shared`、`@nextclaw/kernel`、`@nextclaw/agent-chat-ui`、`@nextclaw/ui` TypeScript 检查通过。
- UI 定向测试 6 个文件 / 67 项、Agent Chat UI 定向测试 2 个文件 / 55 项、Kernel 合同测试 1 个文件 / 1 项通过；覆盖 schema v2、v1 边界兼容、四类 skill 来源、同名 skill 引用身份、直接路径预览和兼容失败提示。
- 隔离工作树基于 `HEAD + 本次精确暂存 diff` 验证：22 个依赖 package 的拓扑构建、`@nextclaw/agent-chat-ui` 构建、`@nextclaw/ui` production build、触达 TypeScript 文件 ESLint、maintainability guard、new-code governance 和 backlog ratchet 全部通过。
- 真实页面验收通过：在运行中的本地页面关闭旧消息的 skill 预览后，点击该消息中的 `proxy-local-ai-subscriptions`，rendered preview 能重新打开；未发送测试消息，也未重启当前实例。

## 发布/部署方式

- 已添加 patch changeset：`@nextclaw/shared`、`@nextclaw/kernel`、`@nextclaw/agent-chat-ui`、`@nextclaw/ui`。
- 本轮只按用户要求提交代码与文档，不执行 push、NPM 发布、runtime channel 发布或线上部署。
- 数据库 migration 不适用：消息 metadata 随既有 session journal 持久化，没有数据库 schema 变更。
- Desktop installer / manifest 不适用：未触达桌面安装与更新合同。

## 用户/产品视角的验收步骤

1. 在会话输入框选择一个 skill 并发送，确认用户消息显示 `$skill-name`，而不是带来源前缀或路径的内部 ref。
2. 点击这条消息里的 skill，确认直接打开保存的 `SKILL.md` rendered preview。
3. 切换 workspace 或重新打开会话，确认新消息仍使用自身保存的路径，不依赖当前 workspace catalog。
4. 打开旧格式消息，确认系统按消息所属 session 兼容解析；无法解析时显示明确错误，而不是点击无反应。

## 可维护性总结汇总

- skill 的持久化类型不再借通用 `key` 隐式编码协议，类型直接表达身份、来源和路径；renderer 不解析 ref 字符串。
- 兼容逻辑只存在于 metadata reader 和旧消息点击边界，没有新增 resolver、service、双写路径或环境扫描 fallback。
- 本次共暂存 24 个文件，总代码与文档 `+1016/-269`；maintainability guard 统计源码和测试 `+849/-269`，非测试源码 `+432/-204`、净增 `+228`。这是新增用户可见的稳定预览能力，因此非功能改动净增门槛不适用。
- 正向减债：Markdown renderer 从 510 行降到 330 行，token Markdown 协议进入 184 行的专用 utils owner；同名 token occurrence 状态进入短生命周期 class owner；skill preview 测试从临近预算的容器测试中拆为独立测试文件。
- 可维护性检查为 0 error / 6 warning；warning 均为已有目录例外或临近预算提醒，没有新增目录文件数，其中 `chat-message-list.container.tsx` 保持在 476/500，后续新增职责前应继续拆分。

## NPM 包发布记录

- 已随 `nextclaw@0.27.2` full public workspace patch batch 统一发布并完成 registry 校验。
- `@nextclaw/shared@0.4.12`、`@nextclaw/kernel@0.6.15`、`@nextclaw/agent-chat-ui@0.6.15`、`@nextclaw/ui@0.15.15` 均已发布，`latest` 依赖闭包与主包一致。
- Stable runtime、公开升级链路和中英文发布说明已闭环，详见 `docs/logs/v0.26.18-npm-patch-release/README.md`。
