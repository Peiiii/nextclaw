# v0.16.1-chat-attachment-card-simplification

## 迭代完成说明

本次迭代完成了聊天附件卡片的一轮直接收敛，目标是让展示更简约、更统一，并去掉不必要的技术感暴露。

已完成内容：

- 将非图片附件卡片从“多 badge + MIME 明文 + 英文说明”改为“文件名 + `类型 · 大小` + 单操作”的简化结构
- 移除附件卡片中的 MIME 展示与重复类型标签，不再显示 `application/octet-stream`、`application/pdf` 这类技术字段
- 为常见文件类别建立稳定类型识别路径，并改为使用 Lucide 文件类专属图标承载 ZIP / PDF / 表格 / 代码等高频类型
- 为附件卡片接入聊天 i18n 文案，补齐 `打开`、`已附加` 以及各类文件类型的中英文映射，避免中文语境下继续出现混杂英文说明
- 将附件相关断言从超长主测试文件中拆出到独立附件测试文件，顺手降低原测试文件长度
- 在第二轮收敛中进一步压紧卡片布局，减少左侧空洞感，提升图标区、文件名和操作按钮之间的整体重心
- 去掉图标内部的小扩展名字样叠加，避免图标区信息打架
- 移除附件卡片默认与 hover 阴影，让组件回到更贴近消息流的安静块级表达

相关设计沉淀：

- [聊天附件卡片简化设计方案](/Users/peiwang/Projects/nextbot/docs/designs/2026-04-12-chat-attachment-card-simplification-design.md)

主要代码入口：

- [chat-message-file/index.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-file/index.tsx)
- [chat-message-file/meta.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-file/meta.ts)
- [chat-message-list.container.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/containers/chat-message-list.container.tsx)
- [i18n.chat.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/lib/i18n.chat.ts)

## 测试/验证/验收方式

已执行：

- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-message-list/chat-message-list.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.attachments.test.tsx`
- `pnpm --filter @nextclaw/ui test -- src/components/chat/containers/chat-message-list.container.test.tsx`
- `pnpm --filter @nextclaw/agent-chat-ui tsc`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm lint:maintainability:guard`

结果：

- 附件展示相关单测通过
- 聊天消息列表容器单测通过
- 两个受影响包的 TypeScript 检查通过
- `pnpm lint:maintainability:guard` 通过，只有既有目录预算警告，无新增阻断

额外说明：

- `pnpm --filter @nextclaw/agent-chat-ui lint` 未通过，失败原因来自包内既有未修复问题与规则债务，不是本次改动引入的新错误
- `pnpm --filter @nextclaw/ui lint` 未通过，失败原因来自 `NcpChatPage`、marketplace 等既有文件中的历史 lint 错误，不是本次改动引入的新错误

## 发布/部署方式

本次变更为前端展示层与共享 UI 包改动，无单独部署动作。

按现有发布链路交付即可：

- 如果只在仓库内消费，随 NextClaw UI 正常构建发布
- 如果需要对外发布共享 UI 组件，按 `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` 现有版本发布流程处理

## 用户/产品视角的验收步骤

1. 打开聊天页面，找到带附件的消息。
2. 验证非图片附件卡片是否只保留文件名、`类型 · 大小` 和一个主操作，不再出现 MIME 或重复 badge。
3. 验证中文环境下卡片按钮与类型文案是否为中文，例如 `打开`、`PDF 文档`、`压缩包`。
4. 验证 ZIP、PDF、表格、代码、图片等文件的左侧类型识别是否稳定，不再全部退化成同一种通用块。
5. 验证图片附件仍优先显示图片预览，而不是降级成普通文件卡片。

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

- 本次是否顺着“代码更少、架构更简单、边界更清晰、复用更通用、复杂点更少”的长期方向推进了一小步：是。
- 推进点：
  - 删掉了附件卡片里对用户无价值的 MIME 暴露和重复 badge
  - 把“类型识别”和“展示文案”拆成更清晰的两层：`meta.ts` 负责分类与展示码，容器负责 i18n 文案注入，卡片组件只负责渲染
  - 把附件测试从超长主测试文件中拆出，减少单文件持续膨胀
- 阻碍与下一步：
  - `chat-message-list` 目录本身仍处于历史性文件数超预算状态，本次未扩大直接平铺，但下一步应继续评估是否按职责把附件渲染、消息复制、消息元信息等拆分到更清晰子目录

### 可维护性复核结论

- 结论：保留债务经说明接受
- 本次顺手减债：是
- no maintainability findings

### 代码增减报告

按本次实际触达的代码文件统计：

- 新增：315 行
- 删除：201 行
- 净增：+114 行

说明：

- 新增主要来自附件卡片简化逻辑、类型文案映射和独立附件测试
- 删除主要来自原附件卡片中的重复 badge / MIME 渲染，以及从超长测试文件中移出的 109 行附件断言

### 非测试代码增减报告

排除 `*.test.*` 与 `__tests__/` 后统计：

- 新增：173 行
- 删除：89 行
- 净增：+84 行

说明：

- 这次不是新增用户能力，而是对已有附件展示做产品化收敛，因此非测试代码净增必须解释最小必要性
- 本次已先完成删减：移除了 MIME 渲染、重复 badge、重复英文说明，并回收了原本散落在 UI 内的重复表达
- 剩余净增主要用于三类最小必要能力：
  - 文件类别展示码与统一卡片骨架
  - 附件卡片 i18n 文案通路
  - 文件类别标签映射
- 如果只做表层替换文案而不补 `texts` 通路，会把语言策略硬编码在展示组件里，长期边界会更差，因此当前增长属于更清晰边界下的最小必要新增

### 可维护性总结

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是；先删掉 MIME、重复 badge 和冗余英文说明，再补最小必要的类型识别与 i18n 通路。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。总代码与非测试代码有最小必要净增长，但直接偿还了主测试文件膨胀债务，并且没有继续恶化 `chat-message-list` 目录的直接平铺度。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。附件分类仍收敛在 `meta.ts`，语言仍从容器注入，展示组件没有继续承担 MIME 判定和多处文案拼接。
- 目录结构与文件组织是否满足当前项目治理要求：未完全满足。`packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list` 与 `packages/nextclaw-ui/src/lib` 仍有历史预算告警；本次未新增直接平铺文件，后续整理入口是继续把消息列表子能力按职责拆出更稳定的子目录。
- 若本次涉及代码可维护性评估，默认是否基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写：是，本节基于实现后独立复核填写，而不是只复述守卫输出。
