# v0.16.72-chat-inline-media-playback

## 迭代完成说明

本次迭代补齐了聊天附件的媒体主路径体验：`asset_put` 产出的音频、视频文件不再只显示成“点了就离开当前消息流”的普通文件卡片，而是直接在聊天消息里提供原生播放器。

根因说明：

- 根因不是后端把资源强制做成下载。资源内容接口 [`ncp-attachment.controller.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-server/src/ui/ui-routes/ncp-attachment.controller.ts) 已经返回 `content-disposition: inline`。
- 真正的根因在前端附件渲染层：[`chat-message-file/index.tsx`](/Users/peiwang/Projects/nextbot/packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-file/index.tsx) 只给图片做了内联预览；即便 [`meta.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-file/meta.ts) 已经把文件分成 `audio` / `video`，最终仍统一降级成带链接的文件卡片。
- 在继续排查真实 MP3 会话后确认还有第二层根因：历史 `asset_put` 产物里存在 `chill_beats.mp3` 这类文件名正确、文件内容正确，但资产元数据 `mimeType` 被记成 `application/octet-stream` 的情况。前端播放器此前把这个泛型 MIME 原样写进 `<source type>`，浏览器会把它当作不支持的媒体源，结果就是界面出现播放器壳子，但时长始终 `0:00 / 0:00`、播放按钮不可用。
- 根因确认方式：
  - 对比前端分类逻辑与渲染逻辑，发现 `audio/video` 仅参与配色与图标，不参与播放器渲染分支。
  - 对比服务端资源接口，确认服务端并未强制 `attachment` 下载头。
  - 结合 `asset_put` 投影链路，确认文件 part 已携带可直接访问的内容 URL，前端缺的是消费这条能力。
- 本次修复直接命中根因：新增媒体渲染分支，让音频走 `<audio controls>`，视频走 `<video controls>`，同时保留显式 `Open` 入口；其余文件继续沿用原文件卡片路径，不新增兜底双路径。
- 本次续改进一步命中第二层根因：
  - 前端播放源 MIME 在 `mimeType` 过于泛化时，按文件名后缀推断真实媒体类型，避免继续把 `.mp3` 送成 `application/octet-stream`
  - 服务端资产内容接口在返回历史旧资产时，也会按文件名补正 `content-type`
  - 资产入库时若未提供明确 MIME，默认按文件名推断，避免未来继续产生错误元数据

本次改动：

- 为音频附件补齐聊天内联播放器，默认在消息流里直接播放。
- 为视频附件补齐聊天内联播放器，默认在消息流里直接播放。
- 把附件头部与图片/媒体渲染拆成更清晰的局部渲染函数，避免把新增能力直接堆进单一大分支。
- 补充附件组件测试，覆盖音频、视频的内联播放器渲染。
- 修正媒体播放源的 MIME 推断，让 `application/octet-stream + chill_beats.mp3` 这类历史资产也能正常被浏览器识别和加载。
- 修正资产内容接口的响应头推断，以及资产存储默认 MIME 推断，防止未来新媒体继续写成泛型二进制。

主要代码入口：

- [chat-message-file/index.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-file/index.tsx)
- [chat-message-file/meta.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-file/meta.ts)
- [chat-message-list.attachments.test.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/__tests__/chat-message-list.attachments.test.tsx)
- [asset-store.ts](/Users/peiwang/Projects/nextbot/packages/ncp-packages/nextclaw-ncp-agent-runtime/src/asset-store.ts)
- [ncp-attachment.controller.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-server/src/ui/ui-routes/ncp-attachment.controller.ts)

## 测试/验证/验收方式

已执行：

- `pnpm exec eslint packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-file/index.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/__tests__/chat-message-list.attachments.test.tsx`
- `pnpm exec eslint packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-file/index.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-file/meta.ts packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/__tests__/chat-message-list.attachments.test.tsx packages/ncp-packages/nextclaw-ncp-agent-runtime/src/asset-store.ts packages/ncp-packages/nextclaw-ncp-agent-runtime/src/attachment-store.test.ts packages/nextclaw-server/src/ui/ui-routes/ncp-attachment.controller.ts packages/nextclaw-server/src/ui/router.ncp-agent.test.ts`
- `pnpm --dir packages/nextclaw-agent-chat-ui test src/components/chat/ui/chat-message-list/__tests__/chat-message-list.attachments.test.tsx`
- `pnpm --dir packages/ncp-packages/nextclaw-ncp-agent-runtime test src/attachment-store.test.ts`
- `pnpm --dir packages/nextclaw-server test src/ui/router.ncp-agent.test.ts`
- `pnpm --dir packages/nextclaw-agent-chat-ui tsc`
- `pnpm --dir packages/ncp-packages/nextclaw-ncp-agent-runtime tsc`
- `pnpm --dir packages/nextclaw-server tsc`
- `pnpm --dir packages/nextclaw-agent-chat-ui lint`

结果：

- 本次改动文件的 `eslint` 通过。
- 附件测试通过，现有 7 条附件相关测试全部通过，其中包含 `application/octet-stream + .mp3` 的回归测试。
- 资产存储测试通过，确认未来新入库 `.mp3` 会默认写成 `audio/mpeg`。
- 服务端路由测试通过，确认历史 `octet-stream` 音频资产会以推断后的 `audio/mpeg` 响应。
- `@nextclaw/agent-chat-ui`、`@nextclaw/ncp-agent-runtime`、`@nextclaw/server` 的 `tsc` 均通过。
- 包级 `lint` 仍失败，但失败项均为历史存量，未包含本次触达文件。当前已确认的历史失败文件包括：
  - `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx`
  - `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/lexical/chat-composer-plugins.tsx`
  - `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/lexical/chat-input-bar-tokenized-composer.tsx`

## 发布/部署方式

本次变更属于前端共享 UI 包行为调整，无单独部署步骤。

按现有交付链路处理即可：

- 仓库内集成交付时，随 NextClaw 前端正常构建发布。
- 若后续需要对外发布共享聊天 UI 包，则在统一 release batch 中带上 `@nextclaw/agent-chat-ui`。

## 用户/产品视角的验收步骤

1. 在聊天里触发一次 `asset_put`，生成一个音频文件。
2. 确认消息气泡中直接出现可播放的音频控件，而不是只有文件卡片和跳转下载。
3. 如果该音频来自旧会话中的历史资产，确认播放器不再停留在 `0:00 / 0:00` 且播放按钮可点击。
4. 在聊天里触发一次 `asset_put`，生成一个视频文件。
5. 确认消息气泡中直接出现可播放的视频控件，而不是只有文件卡片和跳转下载。
6. 再验证一个 PDF 或压缩包附件，确认它仍保持原有文件卡片展示，没有被错误套进媒体播放器分支。

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

- 本次是否顺着“代码更少、架构更简单、边界更清晰、复用更通用、复杂点更少”的长期方向推进了一小步：是。
- 推进点：
  - 把“媒体能播放”收回到现有附件组件主路径，没有额外加一套预览系统、弹窗系统或运行时兜底。
  - 复用既有文件分类与资源 URL 合同，没有新增协议分叉。
  - 在补能力的同时把图片渲染、媒体渲染、文件头部拆成局部函数，避免继续把复杂度堆在主组件分支里。
  - 让 MIME 修正收敛在“播放源推断 + 资产存储/响应头补正”这两个明确边界里，而不是在 UI 层四处散落例外判断。
- 下一步观察点：
  - 如果后续还要支持 PDF 内联预览、文本预览或更丰富的媒体控制，需要评估是否抽出稳定的附件内容区组件；在那之前，当前规模仍适合保留在同一文件内。

### 可维护性复核结论

- 结论：通过
- 本次顺手减债：是
- no maintainability findings

### 代码增减报告

- 新增：502 行
- 删除：106 行
- 净增：+396 行

### 非测试代码增减报告

- 新增：364 行
- 删除：106 行
- 净增：+258 行

说明：

- 这是用户可见能力补强，不属于“纯 bugfix / 纯重构 / 纯结构整理”。
- 本次非测试代码净增主要用于三类最小必要内容：
  - 音频内联播放器渲染
  - 视频内联播放器渲染
  - 降低主组件复杂度的局部渲染函数收敛
  - 资产 MIME 推断与历史旧资产响应头补正
- 已先复用现有文件分类、现有资源 URL 和现有卡片骨架，没有新增协议层、中间状态层或额外 helper 目录，因此当前增长已接近这条能力的最小必要实现。

### 可维护性总结

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是；先确认服务端与分类层都已具备能力，再只补前端缺失的播放器分支，没有把问题扩展成新的资源体系。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：目录与文件平铺度没有恶化，但总代码与非测试代码发生了最小必要净增长；增长用于补齐真实用户能力，并同步偿还了主组件复杂度继续膨胀的风险。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。渲染逻辑仍留在展示组件边界内，未把纯 UI 分支上升成新的 service / manager；同时避免继续把媒体条件分支散落在 JSX 主体里。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足。本次未新增目录，也未扩大 `chat-message-list` 下的文件平铺面；现有组件文件体积仍需后续持续关注，但尚未到必须继续拆分的程度。
- 若本次涉及代码可维护性评估，默认是否基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写：是，本节基于实现完成后的独立复核填写，不是守卫结果复述。

## NPM 包发布记录

- 本次是否需要发包：本次不单独发包。
- 原因：当前任务目标是修正聊天附件媒体体验，代码已落在共享 UI 包中，但本次未执行统一 release batch。
- 涉及包：
  - `@nextclaw/agent-chat-ui`：本次已变更代码，当前状态为 `待统一发布`。
- 已知阻塞或触发条件：
  - 需要等下一次统一前端/共享 UI 发布批次一起处理。
  - 本次未执行 `changeset`、`version` 或 `publish` 流程。
