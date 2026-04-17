# 迭代完成说明

- 撤销了上一版基于上游报错文案 `only support stream` 做条件重试的错误修法，不再把 incident-specific 文本识别写进运行时。
- 将 OpenAI-compatible `responses` 链路改为 stream-first 主合同：`responses` 请求从第一次发送起就固定携带 `stream: true`，`chat()` 与 `chatStream()` 共用同一条流式消费链路，前者聚合最终结果，后者输出增量事件。
- 为 `responses` 流式消费新增独立工具模块，负责 SSE 帧读取、事件归一化、最终响应聚合；provider 保持在协议选择与编排边界内。
- 继续补上两类真实网关变体的通用处理：一类是在 `response.completed` 之后继续附带 `error/upstream_disconnect` 收尾噪声；另一类是 `response.completed.output=[]` 或 `Content-Type=text/plain`，但 body 实际上仍是 SSE 且前面已经给出了 `delta`。现在这些情况都会优先保留已成功收到的流式内容，而不是被空完成态或错误尾帧误伤。
- 同步更新治理技能 `predictable-behavior-first`，明确要求：遇到 `stream` / 非 `stream` 这类协议或传输层不匹配时，必须直接修正主请求合同，禁止先发错再靠错误文本切换模式。

# 测试/验证/验收方式

- 单测：
  - `pnpm -C packages/nextclaw-core test -- openai_provider.test.ts`
- 类型检查：
  - `pnpm -C packages/nextclaw-core tsc`
- 定向真实链路复核：
  - 使用用户提供的 3 组配置，按 UI `测试连接` 同等调用形态执行真实探针：`LiteLLMProvider` + `wireApi=responses` + `messages=[ping]` + `maxTokens=16`
  - 实测结果：
    - `capi_backup`：通过，返回 `pong`
    - `capi2_backup`：失败，真实上游错误为 `limit exceeded, 额度用完了`
    - `yunyi_backup`：通过，返回 `Pong.`
- 维护性守卫：
  - `pnpm lint:maintainability:guard`
  - 结果：本次 `responses` 相关新改动未引入新的 util 级 maintainability error，但全仓命令仍被工作区其它进行中改动阻断
  - 剩余失败原因：当前失败集中在 `packages/ncp-packages/nextclaw-ncp-toolkit/*`、`packages/nextclaw-ncp-runtime-stdio-client/*`、`packages/nextclaw-ui/src/components/chat/ncp/ncp-session-adapter.test.ts`、`packages/nextclaw-hermes-acp-bridge/*` 等与本次 provider 修复无关的既有脏改链路

# 发布/部署方式

- 本次未执行正式发布。
- 如需对外生效，需要发布包含 `@nextclaw/core` 的受影响包，并重启当前本地 NextClaw 实例。
- 本地源码环境验证时，重启服务后重新点击对应 provider 的“测试连接”即可。

# 用户/产品视角的验收步骤

1. 保持 provider 的 `apiBase=https://capi.quan2go.com/openai`，模型保持 `gpt-5.4`。
2. 使用新的 bearer token 重新启动当前本地实例。
3. 进入 provider 配置页并点击“测试连接”。
4. 验收标准：
   - `capi_backup` 与 `yunyi_backup` 可以直接通过测试连接
   - `capi2_backup` 若额度已耗尽，应看到更真实的上游错误，例如 `limit exceeded, 额度用完了`
5. 若后续补足额度，再次测试时应继续确认链路是否进入成功态；届时若仍失败，剩余问题就属于额度/鉴权/中转路由层，而不是 `responses` 的流式合同问题。

# 可维护性总结汇总

- 可维护性复核结论：保留债务经说明接受
- 本次顺手减债：是
- 代码增减报告：
  - 新增：852 行
  - 删除：194 行
  - 净增：+658 行
- 非测试代码增减报告：
  - 新增：714 行
  - 删除：184 行
  - 净增：+530 行
- 本次是否已尽最大努力优化可维护性：是。本次重点不是增加一条更复杂的兼容分支，而是撤销错误方向，回到唯一正确的主合同实现。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。删除了“先请求非流式，再根据报错改成流式”的补丁式思路，避免把临时事故知识沉淀进运行时代码。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：分支复杂度下降了，但总代码仍净增长。净增长主要来自把 `responses` 的主合同、SSE 读取、事件归一化与 payload 解析拆成职责明确的小模块；在接受这部分增长前，已经先删除了 provider 内部的大段内联解析与错误补丁逻辑，把 `openai_provider.ts` 从 `649` 行压到 `555` 行，剩余增长属于修正主合同并接住真实网关变体所需的最小必要实现。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：更清晰。provider 负责协议选择，`responses` 流式消费细节收敛到专用 util；没有再把一次上游事故包装成 provider 内部的永久兼容分支。
- 目录结构与文件组织是否满足当前项目治理要求：部分满足。新拆出的 `responses` util 文件已经满足预算约束，但 `openai_provider.ts` 与 `openai_provider.test.ts` 仍保留历史 legacy 命名，且当前工作区存在与本次无关的 `BrandHeader.tsx` 命名阻断；本次未继续把范围扩成跨模块重命名批次。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已按独立复核口径填写。本次长期方向是把“靠症状兜底”纠偏为“修正主合同”，并把新增逻辑拆到更聚焦的 util 边界；保留债务主要是历史文件命名与既有 provider 文件名未在本批次一并迁移。
