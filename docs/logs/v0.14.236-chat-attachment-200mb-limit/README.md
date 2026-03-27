# v0.14.236-chat-attachment-200mb-limit

## 迭代完成说明

- 将 `@nextclaw/ncp-react` 的默认附件上传上限从 `10 MB` 提升到 `200 MB`，NextClaw 前端聊天输入框随共享常量同步放宽上限。
- 新增 focused test，验证一个 `12 MB` 的图片文件不会再被旧的 `10 MB` 阈值拦截，并且会进入上传批次。
- 已完成版本提升与正式发布：
  - `@nextclaw/ncp-react@0.4.1`
  - `@nextclaw/ui@0.11.1`
  - `nextclaw@0.16.1`

## 测试/验证/验收方式

- 定向验证：
  - `pnpm -C packages/nextclaw-ui exec vitest run src/components/chat/chat-attachment-upload-limit.test.ts`
  - `pnpm -C packages/ncp-packages/nextclaw-ncp-react tsc`
- 仓库级发布验证：
  - `pnpm release:version`
  - `pnpm release:publish`
- `pnpm release:publish` 已完成全仓 `build`、`lint`、`tsc`，并成功执行 `changeset publish` / `changeset tag`。

## 发布/部署方式

- 本次已按仓库标准 NPM 流程执行完成，无需额外部署：
  - `pnpm release:version`
  - `pnpm release:publish`
- 对外可用版本：
  - `@nextclaw/ncp-react@0.4.1`
  - `@nextclaw/ui@0.11.1`
  - `nextclaw@0.16.1`

## 用户/产品视角的验收步骤

1. 安装或使用已发布版本的 NextClaw 前端。
2. 在聊天输入区添加一个大于 `10 MB`、小于等于 `200 MB` 的图片附件，例如 `12 MB` 图片。
3. 确认前端不再弹出旧的 `10 MB` 超限提示，附件会正常进入输入框并可发送。
4. 再尝试添加一个超过 `200 MB` 的附件，确认前端会按新的 `200 MB` 上限拒绝并提示超限。
