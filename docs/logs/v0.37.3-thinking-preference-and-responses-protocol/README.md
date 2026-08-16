# v0.37.3 思考偏好与 Responses 协议修复

## 迭代完成说明

- 修复 OpenAI Responses 历史编码把 assistant 文本错误写为 `input_text` 的问题；assistant 历史现在使用 `output_text`，拒绝内容使用 `refusal`。
- 删除非法的 `input[n].reasoning` 写入。请求思考强度仍只由顶层 `reasoning.effort` 承载，provider 私有 `reasoning_content` 不再作为普通 message 字段回灌。
- 修复用户先选择“思考关闭”、随后首轮会话偏好 hydration 又把界面覆盖为 `High` 的状态竞争。
- 修复 provider 只声明 `low / medium / high` 时，“思考关闭”虽然出现在菜单中、却会被会话偏好合法性检查立即回退的问题；`off` 现在由 NextClaw 作为“不发送 reasoning 参数”的产品级能力统一注入，菜单与状态 owner 共享同一可选档位事实源。
- 修复内部 Chat Completions function tool 结构被原样发送到 Responses API、导致 `Missing required parameter: tools[0].name` 的问题；Responses wire 现在在唯一边界把嵌套的 `function` 定义转换为平铺工具协议。
- 会话偏好保存改为有序执行；成功后更新会话查询缓存，失败时显示错误并只回滚仍可见的最新乐观值。
- 偏好保存不再触发与模型/思考无关的会话技能查询刷新。

根因通过 VPS v0.37.0 运行产物、真实页面错误和本地失败测试三类证据确认：

1. VPS 运行产物确实包含 `output.reasoning = msg.reasoning_content`，与页面 `Unknown parameter: input[n].reasoning` 完全一致。
2. 同一页面还出现 assistant 历史 `input_text` 的 Responses 400，与角色无关的 content normalizer 完全一致。
3. 定向状态测试在修复前稳定得到 `Expected off, Received high`，证明首轮 hydration 会覆盖用户刚刚作出的显式选择。
4. VPS 失败会话的 run metadata 证明实际使用 `codex-sub/gpt-5.6-sol + low`，上游 400 明确指向 `tools[0].name`；对照内部工具对象确认其仍是 Chat Completions 的 `{ type, function: { name, ... } }` 结构，而 Responses API 要求 `{ type, name, ... }`。
5. 服务器旧前端入口仍加载 `index-DotCWGD1.js`，本地修复构建已切换到新哈希；源码对照进一步确认旧菜单主动补入 `off`，但会话偏好 owner 仍只按 provider `supported` 数组判定合法性，因此形成“展示但无法选中”的双事实源冲突。

修复直接收敛 provider wire encoder 和会话偏好 owner，没有通过 400 后删字段重试、延时或额外 UI 补丁掩盖症状。详细机制见 `docs/designs/2026-08-15-thinking-capability-and-responses-protocol.design.md`。

## 测试/验证/验收方式

- `@nextclaw/core` Responses provider 定向测试：19 项通过。
- 最终 Responses tool converter 与 provider 定向测试：2 个测试文件、21 项通过。
- `@nextclaw/ui` 会话输入、偏好 hydration、持久化与会话更新定向测试：23 项通过。
- “provider 只声明 active reasoning levels 时仍可选择并保持 off”的追加回归：4 个测试文件、53 项通过。
- `@nextclaw/agent-chat-ui` 思考选择器定向测试：7 项通过。
- `@nextclaw/core`、`@nextclaw/ui`、`@nextclaw/agent-chat-ui` TypeScript 检查通过。
- `@nextclaw/core` 与 `@nextclaw/ui` 生产构建通过。
- 受影响文件定向 ESLint 无 error；Core provider 仅保留两个本次未新增的参数解构 warning。
- 文件命名、文档命名、目录命名与文件角色治理检查通过。
- diff-only maintainability guard 无 error；5 条 warning 均为既有大文件接近预算线提示。
- 真实 VPS `18791` 使用最终 Core 构建逐档执行 `off / low / medium / high` 四次完整 NCP send + SSE 会话：全部 HTTP 200、精确回复匹配并以 `run.finished` 结束；对应 journal 均未出现 `Responses API failed`、`tools[0].name`、`run.error` 或 `message.failed`。验证会话完成后已通过标准 session API 清理。

VPS 当前只安装了经过上述真实验收的 Core 定向热修，前端静态包仍是旧构建；因此 Core 协议修复具备线上证据，但“Off 可选”仍需正式版本发布并部署后在原页面完成验收。

## 发布/部署方式

- 本轮提交到本地 `master`，但未执行正式 NPM 发布、tag、GitHub Release、runtime channel 更新或前端部署。
- 为完成真实协议验收，VPS 的 `@nextclaw/core` bundle 已定向替换为最终构建并重启；原 bundle 保留备份。该热修不会改变 `0.38.1` 版本号，并可能被后续界面升级覆盖，因此不替代正式发布。
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
- Responses function tool 转换被抽到独立纯函数，而不是继续扩大已到文件预算线的 provider；自动维护性门禁从“跨预算 error”恢复为无 error，provider 仍保持改动前的 599 行。
- 思考档位的产品级 `off` 由共享 provider-model 工具统一补入，工具栏和会话偏好治理不再分别维护一套合法性规则。
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
