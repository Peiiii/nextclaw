# v0.25.20 官网 Office 文件预览展示

## 迭代完成说明

- 修正官网“文件预览”板块图文不一致的问题：不再用 Panel App 或稀疏会话代替文件预览场景。
- 使用本地真实会话与真实 Excel 文件重新生成中英文截图；会话区域展示 PPT、Word、Excel 和素材文件清单，右侧打开天气数据表格。
- 官网文案补充代码、Markdown、HTML、Word、Excel 和 PowerPoint 的预览能力，并保持用户结果表达，不写入截图选择或内部设计过程。
- 新截图使用独立的 `nextclaw-office-file-preview-*` 资产，不覆盖 README 与文档站仍在使用的 HTML 预览图。
- landing 通过 Vite 导入截图，构建产物带内容哈希，避免正式站继续命中旧文件名缓存。
- 精选截图脚本支持 DOCX、XLSX、PPTX 等 Office 二进制文件，并在截图前完成侧栏布局，后续可以复用真实会话快速刷新。

## 测试/验证/验收方式

- `pnpm -C apps/landing tsc`：通过。
- `pnpm -C apps/landing lint`：0 error；保留 `main.ts` 文件长度和 `render` 方法长度两个既有 warning。
- `pnpm exec eslint scripts/docs/product-screenshots/curated-scenes.utils.mjs`：通过。
- `pnpm -C apps/landing build`：通过；生成 `nextclaw-office-file-preview-en-Bi7SDfo4.png` 与 `nextclaw-office-file-preview-cn-_SKo0W-c.png` 内容哈希资源。
- 本地浏览器验收：`http://127.0.0.1:5175/zh/` 的文件预览板块显示真实会话与 Excel 预览，页面无控制台错误。
- 部署预览验收：`https://231faffc.nextclaw-landing.pages.dev/zh/` 显示新文案和哈希图片，图片自然尺寸为 `3024 × 1656`，无控制台错误。
- 正式域名验收：`https://nextclaw.io/zh/` 已加载 `nextclaw-office-file-preview-cn-_SKo0W-c.png`，图片完整加载，无控制台错误。
- maintainability guard：0 error、1 warning；`main.ts` 相对基线净增 0 行，warning 为既有文件预算。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance`：被本迭代范围外的 `apps/platform-console/src/api/client.ts` 与 `workers/nextclaw-provider-gateway-api/src/types/platform.ts` 文件角色命名问题阻塞；本次触达文件的 ESLint 与命名均通过。

## 发布/部署方式

- 使用本机已登录的 Wrangler 将 `apps/landing/dist` 部署到 Cloudflare Pages 项目 `nextclaw-landing` 的 `master` 分支。
- 本次部署地址：`https://231faffc.nextclaw-landing.pages.dev`；正式站入口：`https://nextclaw.io/zh/`。
- 不涉及后端、数据库、migration、runtime update 或桌面端发布。

## 用户/产品视角的验收步骤

1. 打开官网中文首页并找到“文件预览”板块。
2. 确认会话中能看到一组真实生成的 Office 文件和视觉素材，不是空白会话或 Panel App。
3. 确认右侧打开 Excel 表格，并能直接看到多行天气数据。
4. 刷新页面，确认仍加载新图而不是旧的 HTML 或 Panel App 截图。

## 可维护性总结汇总

- 使用了 `post-edit-maintainability-review` 的复核口径。
- 生产源码变更为 `+36 / -20`，净增 16 行；增长来自截图自动化新增 Office 二进制预览能力。
- `main.ts` 只替换文案和资源引用，行数净增 0；没有在超预算入口文件继续堆积结构。
- Office 预览继续复用现有 workspace state 与内置 viewer，没有新增截图流程、并行预览实现或额外 owner。
- 新图只保留在 `images/screenshots/`，landing 由 Vite 生成内容哈希资源，避免维护 public 镜像和缓存版本号。

## 红区触达与减债记录

### apps/landing/src/main.ts

- 本次是否减债：是。
- 说明：改用 Vite 内容哈希资源替代固定 public URL，消除部署后的旧图缓存风险；文件行数相对基线净增 0。
- 下一步拆分缝：继续沿用现有 landing content owner，在后续独立迭代中拆分首页剩余大段静态 copy，不在本次视觉修正中扩大范围。

## NPM 包发布记录

不涉及 NPM 包发布；`@nextclaw/landing` 为私有部署单元，本次只发布官网。
