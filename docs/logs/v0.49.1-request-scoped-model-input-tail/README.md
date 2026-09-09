# v0.49.1 请求级模型输入尾部

## 迭代完成说明

- 新增 `RequestContextTailManager`，统一注册、排序和聚合只作用于当前模型调用的动态上下文。
- `AgentRunModelInputBuilder` 在每个 model step 重新取样尾部并将其计入固定输入预算；provider 发送前追加唯一末尾 `user` 消息，不写入会话消息、journal、projection、compaction 或恢复链路。
- Observation 已迁移为首个 contributor，数据继续以 `untrusted` 标记传输。
- 新公共类型使用 `ModelInputTail` 命名；项目常驻规则明确存量 `NCP / Ncp*` 仅作兼容，后续新增命名禁用该前缀。

## 测试/验证/验收方式

- `@nextclaw/ncp` 与 `@nextclaw/kernel` 构建通过。
- `@nextclaw/ncp`、`@nextclaw/ncp-agent-runtime-next`、`@nextclaw/kernel` TypeScript 检查通过。
- Kernel 定向测试 4 个文件、19 项通过，覆盖 contributor 顺序、空结果、逐次重新取样、Observation 适配、预算计入、provider 尾部追加和原始历史不变。
- 定向 ESLint、skill progressive-loading、diff-only governance、backlog ratchet 与 maintainability guard 通过。

## 发布/部署方式

- 本批只合入源码，不执行 NPM、runtime 或 Desktop 发布。
- `.changeset/request-scoped-model-input-tail.md` 已记录后续统一发布所需的版本变化。

## 用户/产品视角的验收步骤

本批建立后续时间等动态事实的底座，没有新增独立 UI。通过原生 agent 请求链验证：动态尾部只出现在当次 provider 输入末尾，原始会话历史保持不变，下一次模型调用重新获取最新值。

## 可维护性总结汇总

- Observation 专用 transport 与序列化路径已删除，动态请求上下文收敛到一个 manager 和一个 serializer owner。
- 新增能力没有继续制造 `NCP / Ncp*` 命名；存量外围协议名保持兼容，不在本批扩大迁移范围。
- 自动可维护性检查无错误；`nextclaw-kernel.ts` 达到 400 行预算边界，测试文件接近预算但未越线。
- 未新增 fallback、重试、双写或兼容 alias，失败继续沿现有模型输入构建链显式传播。

## NPM 包发布记录

- `@nextclaw/kernel`：需要发布，状态为待统一发布。
- `@nextclaw/ncp`：公共输入类型变化，需要发布，状态为待统一发布。
- `@nextclaw/ncp-agent-runtime-next`：仅完成兼容性类型检查，本批无独立 changeset。

## 红区触达与减债记录

### packages/nextclaw-kernel/src/app/nextclaw-kernel.ts

- 本次是否减债：否。
- 说明：组合根新增 request-tail manager 的创建与 dispose，文件由 398 行增至 400 行，未超过预算但已到边界。
- 下一步拆分缝：后续再次触达时，将 session/runtime 相关 manager 的组装提取到现有 composition factory，而不是继续扩张组合根构造器。
