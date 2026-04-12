# v0.16.3-openai-tool-schema-guard

## 迭代完成说明

- 修复 `asset_put` 的 provider-facing tool schema：移除顶层 `oneOf`，改为普通 `object` + `additionalProperties: false`。
- 将 `asset_put` 的“二选一输入模式”约束下沉到运行时 `validateArgs`，避免把条件编排放到 provider-facing schema 顶层。
- 收紧本地断言：所有进入 OpenAI tools 的 `parameters` 都必须显式声明为 `type: "object"`；即使是无参工具，也必须提供空 object schema。
- 在 NCP 两条 OpenAI tool 组装链路里统一接入本地断言：
  - `packages/ncp-packages/nextclaw-ncp-agent-runtime/src/context-builder.ts`
  - `packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.ts`
- 新增项目内规范文档：
  - [OpenAI Tool Schema 规范](../../internal/openai-tool-schema.md)
- 新增回归测试，覆盖：
  - 合规 schema 可通过
  - 顶层 `oneOf` 会在本地被阻断
  - 缺失 `parameters` 会在本地被阻断
  - `asset_put` 的运行时互斥校验

## 测试 / 验证 / 验收方式

- 单测：
  - `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime test -- src/__tests__/openai-tool-schema.test.ts src/__tests__/utils.test.ts src/context-builder.test.ts`
  - `pnpm -C packages/nextclaw test -- src/cli/commands/ncp/runtime/ncp-asset-tools.test.ts src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts`
- 类型检查：
  - `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime tsc`
  - `pnpm -C packages/nextclaw tsc`
- 定向 lint：
  - `pnpm -C packages/nextclaw exec eslint src/cli/commands/ncp/runtime/ncp-asset-tools.ts src/cli/commands/ncp/runtime/ncp-asset-tools.test.ts src/cli/commands/ncp/nextclaw-ncp-context-builder.ts`
  - 结果：无 error，有 2 条历史 legacy warning，不属于本次新增问题
- 维护性守卫：
  - `pnpm lint:maintainability:guard`
  - 结果：通过；存在 2 条 legacy warning：
    - `packages/ncp-packages/nextclaw-ncp-agent-runtime/src` 目录仍偏平
    - `packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.ts` 接近文件预算
- 真实 provider 复测：
  - 使用本机 `custom-2 -> https://yunyi.cfd/codex`
  - 顶层 `oneOf` 请求 `/chat/completions` 返回 `400`
  - `asset_put` 当前 object schema 请求 `/chat/completions` 返回 `200`
  - 顶层 `oneOf` 请求 `/responses` 返回 `400`
  - 结论：本次导致对话入口直接 400 的 schema 形状问题已打掉

## 发布 / 部署方式

- 本次无需额外部署脚本变更。
- 合并后按正常 `nextclaw` 服务发布流程发布即可。
- 若线上服务已常驻，需要重启到包含本次代码的版本后生效。

## 用户 / 产品视角的验收步骤

1. 启动包含本次修复的服务版本。
2. 走一条会带工具定义的 native / 微信会话。
3. 发送一条普通消息，例如“你好”。
4. 确认 provider 不再因 `tools[].function.parameters` 非法而直接 400。
5. 若模型调用 `asset_put`：
   - 传 `path` 时应正常通过。
   - 同时传 `path` 和 `bytesBase64` 时，应收到本地参数校验错误，而不是 provider 请求级失败。
6. 若后续有人新增顶层 `oneOf/anyOf/allOf/not/enum` 的 tool schema，本地应在 context builder 阶段直接报错，阻止请求发出。
7. 若后续有人新增无参工具但漏写 `parameters`，本地也应直接报错，要求改成空 object schema。

## 可维护性总结汇总

- 是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次没有引入新的兼容层或 schema 转换层，而是直接把错误 schema 改成合规 schema，并把复杂约束放回原本就存在的运行时校验入口。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：基本做到。原本一度新增了单独 helper 文件，但已回收进现有 `utils.ts`，避免继续增加目录平铺度。代码增减报告如下：
  - 新增：187 行
  - 删除：108 行
  - 净增：79 行
- 非测试代码增减报告：
  - 新增：149 行
  - 删除：74 行
  - 净增：75 行
- 若出现净增长，其最小必要性以及同步偿还的维护性债务：
  - 本次净增长主要来自两部分：
    - 项目内长期规范文档
    - 通用的 provider schema 本地断言
  - 这部分增长已经是当前目标下的最小必要新增；同时偿还了“错误 schema 只能等线上 provider 400 才暴露”的维护性债务。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：
  - 更清晰。provider schema 约束被收进现有 `utils.ts`，保持为薄 helper；业务互斥逻辑留在 `asset_put.validateArgs`；没有新增新的 service / manager / adapter 层。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 基本满足。本次新增文件只落在 `docs/internal` 与测试目录，避免继续增加 `nextclaw-ncp-agent-runtime/src` 的直接文件数。
  - 仍有历史遗留 warning：
    - `packages/ncp-packages/nextclaw-ncp-agent-runtime/src` 目录整体偏平
    - `packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.ts` 接近预算
  - 本次未继续拆目录，是为了避免把一个局部 schema 修复扩成结构性重构。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：
  - 已执行独立复核。
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - no maintainability findings
  - 可维护性总结：
  - 这次改动把问题收敛回“源头不犯错”，没有引入兼容补丁链，整体更可预测。
  - 代码有小幅净增，但已经把新增 helper 回收到现有 `utils.ts`，同时顺手收掉了本次触达文件里的 context destructuring / params destructuring warning，避免把治理债务继续往后拖。
  - 后续真正需要继续关注的是 `nextclaw-ncp-agent-runtime/src` 的目录平铺度，以及 `nextclaw-ncp-context-builder.ts` 的拆分时机。
