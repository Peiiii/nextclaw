# v0.13.63-ncp-skeleton-deimplementation

## 迭代完成说明（改了什么）

- 按“先设计、避免过早实现”的要求，将 `@nextclaw/ncp` 中的 `AbstractAgentEndpoint` 从可执行编排实现回收为草案级骨架。
- 保留扩展点与类型轮廓（`resolveModel`、`executeTurn`、`prepareSessionState`），但 `handleInbound`/`processDirect` 仅保留占位错误，明确尚未进入实现阶段。
- 在抽象基类中补充了少量英文注释，用于表达“这是草案层结构，不是运行时落地代码”。
- 将注释语言统一为英文，避免中文注释。

## 测试/验证/验收方式

- 执行：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ncp lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ncp tsc`
- 结果：
  - lint/tsc 均通过。
- 不适用项：
  - 冒烟测试不适用（本次仅草案层骨架调整，未新增可运行行为）。

## 发布/部署方式

- 本次无发布/部署动作。
- 待协议设计冻结后，再进入实现迭代并按 npm 流程发布。

## 用户/产品视角的验收步骤

1. 打开 `packages/nextclaw-ncp/src/endpoint/abstract-agent-endpoint.ts`，确认流程方法为占位骨架而非完整实现。
2. 打开 `packages/nextclaw-ncp/src/endpoint/abstract-endpoint.ts`，确认仅保留最小生命周期与订阅基础层。
3. 确认注释为英文，且不包含中文注释。

