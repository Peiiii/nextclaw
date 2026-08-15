# v0.37.3 思考偏好与 Responses 协议修复

## 迭代完成说明

- 修复 OpenAI Responses 历史编码把 assistant 文本错误写为 `input_text` 的问题；assistant 历史现在使用 `output_text`，拒绝内容使用 `refusal`。
- 删除非法的 `input[n].reasoning` 写入。请求思考强度仍只由顶层 `reasoning.effort` 承载，provider 私有 `reasoning_content` 不再作为普通 message 字段回灌。
- 修复用户先选择“思考关闭”、随后首轮会话偏好 hydration 又把界面覆盖为 `High` 的状态竞争。
- 会话偏好保存改为有序执行；成功后更新会话查询缓存，失败时显示错误并只回滚仍可见的最新乐观值。
- 偏好保存不再触发与模型/思考无关的会话技能查询刷新。

根因通过 VPS v0.37.0 运行产物、真实页面错误和本地失败测试三类证据确认：

1. VPS 运行产物确实包含 `output.reasoning = msg.reasoning_content`，与页面 `Unknown parameter: input[n].reasoning` 完全一致。
2. 同一页面还出现 assistant 历史 `input_text` 的 Responses 400，与角色无关的 content normalizer 完全一致。
3. 定向状态测试在修复前稳定得到 `Expected off, Received high`，证明首轮 hydration 会覆盖用户刚刚作出的显式选择。

修复直接收敛 provider wire encoder 和会话偏好 owner，没有通过 400 后删字段重试、延时或额外 UI 补丁掩盖症状。详细机制见 `docs/designs/2026-08-15-thinking-capability-and-responses-protocol.design.md`。

## 测试/验证/验收方式

- `@nextclaw/core` Responses provider 定向测试：19 项通过。
- `@nextclaw/ui` 会话输入、偏好 hydration、持久化与会话更新定向测试：23 项通过。
- `@nextclaw/agent-chat-ui` 思考选择器定向测试：7 项通过。
- `@nextclaw/core`、`@nextclaw/ui`、`@nextclaw/agent-chat-ui` TypeScript 检查通过。
- `@nextclaw/core` 与 `@nextclaw/ui` 生产构建通过。
- 受影响文件定向 ESLint 无 error；Core provider 仅保留两个本次未新增的参数解构 warning。
- 文件命名、文档命名、目录命名与文件角色治理检查通过。
- diff-only maintainability guard 无 error；5 条 warning 均为既有大文件接近预算线提示。

本轮没有部署新产物到 VPS，因此没有把修复前的 VPS 证据冒充为修复后的线上验收。真实 VPS 验收需在版本发布和部署后按下一节执行。

## 发布/部署方式

- 本轮未提交、未发布、未部署，也未重启 VPS。
- 发布时由常规 NPM 发布链路携带 `nextclaw`、`@nextclaw/core` 与 `@nextclaw/ui` patch 变更；本次仅授权 NPM，不更新 runtime channel。
- 部署完成后必须使用原 VPS 公网页面和同一 OpenAI Responses provider 做两轮会话验证。

## 用户/产品视角的验收步骤

1. 在独立测试会话选择支持思考的 OpenAI Responses 模型，并选择 `High`。
2. 完成一轮产生 reasoning 的回复后继续发送第二轮，确认不再出现 `input[n].reasoning` 或 assistant `input_text` 400。
3. 从 `High` 切换到“思考关闭”，确认工具栏立即显示关闭。
4. 刷新页面，确认仍显示关闭；继续发送一条消息并确认回复成功。
5. 快速连续切换多个思考档位，确认最终界面和刷新后的值均为最后一次选择。
6. 在隔离环境模拟偏好保存失败，确认显示错误、恢复为上一个已确认值，并且不会发起会话技能刷新请求。

## 可维护性总结汇总

- Responses 角色编码被收敛为明确的文本、拒绝、图片、tool call 与 tool output helper；删除非法 reasoning message 分支后，原有认知复杂度 warning 已消除。
- 新增的偏好持久化 hook 只拥有远端写入顺序、缓存确认和失败回滚，不复制 draft/store 状态；本地偏好仍由既有 preference actions owner 管理。
- 主输入组件文件相对改动前净行数为 0，没有继续扩大既有大组件。
- 自动维护性检查无 error；因跨模块和文件预算 warning 做了主观复核，未发现重复 owner、隐藏 fallback 或需要继续返工的问题。
- 新增 hook、测试、设计和迭代文件均通过目录与命名治理。

## NPM 包发布记录

- 需要发布：是，属于用户可见的 Core 协议修复与 UI 状态修复。
- `@nextclaw/core`：patch changeset 已添加，尚未发布，待统一发布。
- `@nextclaw/ui`：patch changeset 已添加，尚未发布，待统一发布。
- `nextclaw`：因嵌入受影响的 UI 产物，patch changeset 已补齐，尚未发布，待统一发布。
- 本轮未执行 NPM publish、tag、GitHub Release 或 runtime channel 更新。
