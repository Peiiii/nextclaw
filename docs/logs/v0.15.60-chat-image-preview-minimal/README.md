# v0.15.60-chat-image-preview-minimal

## 迭代完成说明（改了什么）

本次迭代收敛了聊天消息里的图片附件展示，目标是让“图片看起来就是图片”，而不是继续套一层厚重的文件卡片。

- 将 [chat-message-file/index.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-file/index.tsx) 的图片分支改成内容优先的轻量展示：
  - 去掉原来的 `figure + figcaption + 文件元信息卡片` 组合；
  - 默认按接近 Markdown 图片的方式直接展示图片本体；
  - 仅在右上角保留很小的格式/大小标记，减少视觉噪音。
- 将图片渲染判断从单纯依赖 `isImage` 标记，补强为“只要看起来是图片就按图片展示”：
  - 支持 `mimeType` 为 `image/*`；
  - 支持文件扩展名为常见图片格式；
  - 支持 `data:image/...` 形式的数据 URL。
- 调整图片展示细节：
  - 从 `object-cover` 改为 `object-contain`，避免图片被裁切；
  - 保留轻量边框与 hover 反馈，但不再抢走图片本体的视觉重心。
- 更新 [chat-message-list.test.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.test.tsx)：
  - 回归验证图片附件走轻量预览样式；
  - 新增“即使 `isImage=false`，只要扩展名 / data URL 表明它是图片，也按图片渲染”的覆盖；
  - 顺手复用现有 `defaultTexts`，把测试文件从超预算状态拉回预算内。
- 同批次续改补丁：
  - 修复本地 dev 场景下，选择图片后回车发送时访问 `/api/ncp/assets/content` 被 Vite 代理报 `Duplicate Content-Length` 的问题。
  - 从 [ncp-attachment.controller.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-server/src/ui/ui-routes/ncp-attachment.controller.ts) 与 [index.ts](/Users/peiwang/Projects/nextbot/apps/ncp-demo/backend/src/index.ts) 的资源内容响应中删除手写 `content-length`，避免 Node/Hono 适配层再自动补一次长度头。
  - 在 [router.ncp-agent.test.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-server/src/ui/router.ncp-agent.test.ts) 新增真实 Node HTTP 层回归测试，直接校验资源内容响应只发出一次 `Content-Length`。
- 同批次续改补丁：
  - 修复 Codex 规划 / Codex 会话里“粘贴或选择图片后发送，AI 感知不到附件存在”的问题。
  - 根因是 [codex-input-builder.ts](/Users/peiwang/Projects/nextbot/packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-input-builder.ts) 之前只读取最后一条用户消息里的纯文本 part，直接忽略 file part，导致图片虽然上传成功，但拼给 Codex runtime 的最终 prompt 里没有任何附件信息。
  - 现在改为把当前用户消息里的图片/文件 part 一并转成统一的资产引用块，再交给 Codex runtime prompt builder；这样 Codex 至少能明确感知“这里有一个图片资产”，并按现有 `asset_export` 路径继续检查，而不是静默丢失。
  - 在 [codex-input-builder.test.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/compat/codex-input-builder.test.ts) 补了定向回归测试，覆盖纯文本消息不变、文件 part 会进入 Codex prompt 这两条关键路径。
- 同批次续改补丁：
  - 修复主 NCP / OpenAI 聊天链路里“图片能上传、能预览、也能导出，但模型本身看不到图像内容”的问题。
  - 根因是共享运行时 [user-content.ts](/Users/peiwang/Projects/nextbot/packages/ncp-packages/nextclaw-ncp-agent-runtime/src/user-content.ts) 之前把所有 `file` part 一律降级成资产说明文本块，导致 `image/png` 这类图片附件虽然存在于消息里，但最终给模型的 `content` 只有 `[Asset: ...]`、`[MIME: ...]` 等说明，而没有真正的 `image_url` 多模态输入。
  - 本次保持现有前端上传、`NcpFilePart`、资产存储与 `assetUri` 抽象不变，只在共享运行时做最小改动：
    - `image/*` 附件现在会优先转成真正的 `image_url` 多模态 part；
    - 同一张图仍追加一段很短的资产 hint 文本，把 `assetUri` 暴露给模型，便于后续图像处理工具继续沿现有资产流工作；
    - 非图片文件仍保持原来的资产引用文本行为，不引入行为漂移。
  - 在 [context-builder.test.ts](/Users/peiwang/Projects/nextbot/packages/ncp-packages/nextclaw-ncp-agent-runtime/src/context-builder.test.ts) 与 [nextclaw-ncp-context-builder.test.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts) 补了当前轮图片、历史图片、上传图片资产三条关键回归测试，确认图片现在会真正进入模型输入，而不是继续只剩资产说明。

## 测试 / 验证 / 验收方式

- 定向单测：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:/usr/local/bin:$PATH pnpm --filter @nextclaw/agent-chat-ui test -- --run src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`
- 类型检查：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:/usr/local/bin:$PATH pnpm --filter @nextclaw/agent-chat-ui exec tsc --noEmit`
- 构建验证：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:/usr/local/bin:$PATH pnpm --filter @nextclaw/agent-chat-ui build`
- 维护性守卫：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:/usr/local/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：通过；存在仓库既有目录/体量 warning，但无新增错误。
- 新代码治理检查：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:/usr/local/bin:$PATH pnpm lint:new-code:governance`
  - 结果：通过。
- 本轮续改补丁验证：
  - `pnpm -C packages/nextclaw-server test -- --run src/ui/router.ncp-agent.test.ts -t "stores uploaded ncp assets and serves their content back|serves uploaded ncp assets through node http without duplicate content-length headers"`
  - `pnpm -C packages/nextclaw-server tsc`
  - `pnpm -C packages/nextclaw-server lint`
  - `pnpm -C apps/ncp-demo/backend tsc`
  - 结果：
    - 定向资源内容测试通过，新增的 Node HTTP 回归测试通过。
    - `packages/nextclaw-server tsc` 通过。
    - `pnpm lint:maintainability:guard` 通过。
    - `packages/nextclaw-server lint` 失败来自仓库既有未使用变量 / 超长文件等历史问题，不是本次资源头修复引入。
    - `apps/ncp-demo/backend tsc` 失败来自现有 `AgentSessionStore.replaceSession` 接口缺口，不是本次资源头修复引入。
- 本轮续改补丁验证：
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/compat/codex-input-builder.test.ts`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk tsc`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk build`
  - `pnpm lint:maintainability:guard`
  - 结果：
    - Codex 输入构造定向单测通过，确认 file part 会进入最终 prompt。
    - `packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk tsc` 通过。
    - `packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk build` 通过。
    - `pnpm lint:maintainability:guard` 通过；仅剩扩展目录既有平铺 warning，没有新增错误。
- 本轮续改补丁验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/ncp-agent-runtime exec vitest run src/context-builder.test.ts`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter nextclaw exec vitest run src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts`
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：
    - 两组定向单测通过，确认图片附件现在会转成真正的多模态 `image_url` 输入，普通文件附件仍保持原来的资产引用路径。
    - `pnpm lint:maintainability:guard` 对本次图片链路改动的新增代码治理检查通过。
    - 同一次守卫在仓库其它已修改文件上失败：`packages/nextclaw-ui/src/components/chat/hooks/use-chat-session-update.ts` 命中既有 `context-destructuring` 治理项；这不是本次图片输入修复引入，因此本次未越 scope 去改该文件。

## 发布 / 部署方式

- 本次仅涉及前端聊天附件渲染与测试，未执行正式发布。
- 如需产出受影响包构建结果，可执行：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:/usr/local/bin:$PATH pnpm --filter @nextclaw/agent-chat-ui build`
- 如需走前端既有发布链路，可按项目既有流程继续执行前端 release 闭环；本次未触发独立部署或 migration。

## 用户 / 产品视角的验收步骤

1. 打开聊天页面，发送或载入一条带图片附件的消息。
2. 确认图片默认直接以图片本体展示，而不是带大块文件说明区的卡片。
3. 确认右上角只保留很小的格式 / 大小标记，没有大段 `mimeType`、文件类别说明或附件操作 pill 抢视觉焦点。
4. 确认图片完整显示，不会像之前那样因为 `cover` 被裁切。
5. 点击图片，确认仍可打开预览。
6. 准备一个 `mimeType` 不规范、但扩展名或 `data:image/...` 明确是图片的附件，确认它仍按图片展示，而不是退回文件卡片。
7. 在本地 dev 环境中，从输入面板选择一张图片后直接回车发送。
8. 确认 dev 终端不再出现 `http proxy error: /api/ncp/assets/content ... Duplicate Content-Length`。
9. 确认图片消息可以正常发送，且消息里的图片仍能正常预览。
10. 切到 `codex` 会话类型，粘贴一张截图或通过附件按钮选择一张图片后发送。
11. 确认 Codex 不再像之前那样完全忽略附件，而会在回复里体现出它知道当前消息带了一个图片/资产。
12. 若让 Codex 进一步检查图片内容，确认它会沿现有资产工作流提示或调用 `asset_export`，而不是表现得像这条消息只有纯文本。
13. 在主聊天链路里上传或粘贴一张图片，然后直接问“这张图里是什么？”。
14. 确认模型回答基于图片本身内容，而不再只是表现出“知道这里有一个附件”。
15. 再继续要求“把这张图做后续处理”或触发既有图像/资产工具流，确认模型仍保留对同一 `assetUri` 的引用能力，没有因为图片进入 vision 输入而丢掉后续文件处理入口。

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：
  - 这次改动顺着“统一入口体验更自然”的方向推进了一小步。图片消息不再把内部附件语义强行暴露给用户，而是更接近用户心智里的“这就是一张图”，符合 NextClaw 应该替用户吸收工具复杂度的产品方向。
- 是否已尽最大努力优化可维护性：
  - 是。本次优先复用既有文件渲染组件，没有新增新的附件组件层、状态层或样式系统分叉，而是在现有入口内收敛图片判定和展示路径。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：
  - 是。主方向不是继续给图片卡片打补丁，而是直接删掉厚重的 `figcaption`/元信息展示，让图片分支退回更简单的单一路径。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 是。此次总代码净变更为 `-3` 行；未新增文件，目录平铺度未恶化。虽然非测试代码净增 `+16` 行，但它换来的是更稳的图片识别逻辑，同时图片渲染模板本身显著简化，属于最小必要增长。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：
  - 是。新增的 `isImageFileLike` 仍留在现有 `meta.ts` 这一层，职责是“判断文件应该如何被呈现”，没有再平铺出新的 helper 文件或多层适配。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 部分满足。本次未新增目录结构债务；但 [packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list](/Users/peiwang/Projects/nextbot/packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list) 仍处在仓库既有目录预算 warning 区间，后续若继续扩展文件/图片消息形态，宜优先按责任拆分子目录，而不是继续往当前目录平铺。
- 独立于实现阶段的可维护性复核：
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：121 行
    - 删除：124 行
    - 净增：-3 行
  - 非测试代码增减报告：
    - 新增：72 行
    - 删除：56 行
    - 净增：+16 行
  - no maintainability findings
  - 可维护性总结：
    - 这次改动让图片展示路径更小、更直接，也避免把“是否是图片”的判断绑死在单一上游标记上。
    - 保留的少量非测试净增长主要用于图片识别兜底，已经是为了保证行为可预测所需的最小必要实现。
    - 后续需要继续留意的切口是把 [packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list](/Users/peiwang/Projects/nextbot/packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list) 目录按职责进一步拆开，避免消息展示能力继续在单层目录里堆叠。
- 本轮续改补丁的独立可维护性复核：
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：74 行
    - 删除：2 行
    - 净增：+72 行
  - 非测试代码增减报告：
    - 新增：0 行
    - 删除：2 行
    - 净增：-2 行
  - no maintainability findings
  - 可维护性总结：
    - 这次补丁是典型的非功能修复，真正落到运行链路的改动只有删除两处重复 `content-length`，让系统更简单也更可预测。
    - 代码净增主要来自 Node HTTP 回归测试，不是把复杂度搬进生产代码；生产代码本身反而更少了。
    - 后续观察点是如果还有其它二进制内容接口手写 `content-length`，应统一复查，避免在 Node 适配层重复踩同类坑。
- 本轮续改补丁的独立可维护性复核：
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：129 行
    - 删除：2 行
    - 净增：+127 行
  - 非测试代码增减报告：
    - 新增：58 行
    - 删除：2 行
    - 净增：+56 行
  - no maintainability findings
  - 可维护性总结：
    - 这次修复把“Codex 输入只看文本、静默丢附件”这个隐藏行为改成了显式、可预测的资产引用输入，方向上更符合统一入口产品应替用户吸收复杂度的目标。
    - 生产代码净增来自把 file part 正式纳入 Codex prompt 构造，已经是最小必要补齐；没有新增新模块、新状态层或补丁式分叉。
    - 后续更好的升级缝是把这套附件到 prompt 的归一化能力继续抽成跨 runtime 共享层，但在当前范围内，先消除“附件完全不可见”的行为错误优先级更高。
- 本轮续改补丁的独立可维护性复核：
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：335 行
    - 删除：26 行
    - 净增：+309 行
  - 非测试代码增减报告：
    - 新增：156 行
    - 删除：17 行
    - 净增：+139 行
  - no maintainability findings
  - 可维护性总结：
    - 这次修复是非新增功能的行为纠偏，重点不在扩能力面，而在把“图片附件只剩资产文本、模型看不到图”这个错误行为收回到可预测的多模态输入契约里。
    - 生产代码净增集中在共享运行时的图片解析与 data URL 构造，前端协议、附件存储与资产抽象完全复用，没有新增第二套图片消息模型，已经到达当前约束下的最小必要实现。
    - 保留的维护性观察点是 [user-content.ts](/Users/peiwang/Projects/nextbot/packages/ncp-packages/nextclaw-ncp-agent-runtime/src/user-content.ts) 体量明显增长；若后续继续扩展更多模态，下一步应把“附件解析 / 视觉输入构造 / 资产 hint 生成”拆成更细的责任边界，而不是继续向单文件平铺。
