# v0.0.1-openai-chat-payload-guard

## 迭代完成说明（改了什么）

- 修复了 OpenAI 兼容 Provider 在处理非标准 `chat.completions` 返回时的崩溃问题。
- 之前逻辑直接读取 `response.choices[0]`，当中转站返回不包含 `choices` 时会抛出：
  - `TypeError: Cannot read properties of undefined (reading '0')`
- 现在改为：
  - 先校验 payload 结构；
  - 缺少 `choices` 时抛出可读错误（包含 payload 预览）；
  - `auto` 模式下把该场景识别为可回退，自动尝试 Responses API。
- 同时补充了 tool call 解析时的类型收窄，避免 `unknown` 结构再次触发运行时/类型问题。
- 为提升可维护性，将 `chat.completions` 响应归一化逻辑抽离为独立模块，并增加单元测试覆盖异常分支。

## 变更文件

- `packages/nextclaw-core/src/providers/openai_provider.ts`
- `packages/nextclaw-core/src/providers/chat-completions-normalizer.ts`
- `packages/nextclaw-core/src/providers/chat-completions-normalizer.test.ts`
