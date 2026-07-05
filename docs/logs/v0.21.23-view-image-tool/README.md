# v0.21.23 View Image Tool

## 迭代完成说明

- 新增 Codex 风格 `view_image` agent 工具，让模型可以主动读取本地 PNG、JPEG、WebP、GIF 图片，并把图片作为视觉输入进入下一轮模型上下文。
- 工具 owner 落在 `@nextclaw/core` 的 `features/agent/tools/image.tools.ts`，与 `ReadFileTool` / `ListDirTool` 同属 core agent tools；`nextclaw-kernel` 只负责注册，runtime 只负责解释工具结果中的图片内容。
- `view_image` 不硬编码只能读取 workspace。默认允许读取当前进程可访问的本地路径；当 `tools.restrictToWorkspace=true` 时，继承现有工具安全策略并限制在 workspace 内。
- 限制模式下使用 `realpath` 做真实路径校验，避免 workspace 内 symlink 指向外部文件绕过边界。
- 工具结果返回 `{ type: "image", mimeType, detail, data }` 图片块；`ToolResultContentManager` 会抽取为 `input_image`，同时从文本结果中省略 base64，避免把图片 payload 当普通文本持久化或塞进 tool message。
- 方案文档已写入 `docs/designs/2026-07-05-view-image-tool.design.md`。

## 测试/验证/验收方式

- Core 工具行为：`pnpm -C packages/nextclaw-core test -- src/features/agent/features/tests/filesystem.tool.test.ts` 通过，1 个测试文件、9 个测试通过。
- NCP runtime 图片结果链路：`pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime test -- src/__tests__/utils.test.ts src/__tests__/tool-result-content.manager.test.ts` 通过，2 个测试文件、9 个测试通过。
- Kernel 工具注册：`pnpm -C packages/nextclaw-kernel test -- src/contributions/tool-provider/providers/core-tool.provider.test.ts` 通过，1 个测试文件、2 个测试通过。
- Runtime-next 视觉输入：`pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next test -- src/runtime/agent-runtime.service.test.ts src/runtime/agent-runtime-visual-output.test.ts` 通过，2 个测试文件、8 个测试通过。
- 类型检查：`pnpm -C packages/nextclaw-core tsc`、`pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime tsc`、`pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next tsc`、`pnpm -C packages/nextclaw-kernel tsc` 均通过。
- Lint：`pnpm -C packages/nextclaw-core lint`、`pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime lint`、`pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime-next lint`、`pnpm -C packages/nextclaw-kernel lint` 均为 0 error；core/kernel 仍有既有 warning，不属于本次新增文件。
- 构建声明：`pnpm -C packages/nextclaw-core build` 通过，用于刷新本地 dist 声明，使 kernel 的 `@nextclaw/core` public export 可见。
- 治理检查：`pnpm lint:new-code:governance -- <view_image touched files>` 通过；`pnpm check:governance-backlog-ratchet` 通过；`pnpm lint:maintainability:guard` 通过。

## 发布/部署方式

- 未部署。
- 未推送。
- 本次将随本提交进入仓库，后续进入统一发布批次。
- 已新增 changeset：`.changeset/view-image-tool.md`。

## 用户/产品视角的验收步骤

- 在 agent 可用工具列表中应出现 `view_image`。
- 模型调用 `view_image({ "path": "/absolute/or/workspace-relative/image.png" })` 后，应得到结构化工具结果，并在下一轮模型输入中看到对应 `image_url` 视觉观察。
- `tools.restrictToWorkspace=false` 时，应允许读取当前进程可访问的 workspace 外绝对图片路径。
- `tools.restrictToWorkspace=true` 时，workspace 外路径和 symlink 逃逸路径都应被拒绝。
- 工具文本结果不应包含裸 base64 图片数据，图片 payload 只应通过模型视觉内容项传递。

## 可维护性总结汇总

- 本次先把工具放入 runtime 的初版实现已被纠正：最终工具 owner 收敛到 `@nextclaw/core`，runtime 只保留图片结果管线职责。
- 为避免撑大既有 `filesystem.tools.ts`，最终新增独立 `image.tools.ts`，并通过 agent tools 公共入口导出。
- `view_image` 继承现有 `restrictToWorkspace` 策略，不新增第二套安全配置。
- 使用格式嗅探和大小上限保证行为可预测；未引入图片解码、resize 或 provider-specific 分支。
- `post-edit-maintainability-guard` 通过，0 error；剩余 warning 来自当前工作区已有/并行 UI 改动。

## NPM 包发布记录

- 本次未执行 NPM 发布。
- 需要后续统一发布的包：`@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/ncp-agent-runtime`。
- 当前状态：已新增 patch changeset，待统一发布。
