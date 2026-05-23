# v0.19.19 WeChat QR Refresh

## 迭代完成说明

- 将 GitHub README 使用的微信群二维码资产更新为 2026-05-23 新图：`images/contact/nextclaw-contact-wechat-group.png`。
- 将官网二维码资产更新为 2026-05-23 新图，并把 landing 源码中的社群二维码入口切到 `/contact/nextclaw-contact-wechat-group-2026-05-23.png`。
- 同步更新官网通用二维码资产：`apps/landing/public/contact/nextclaw-contact-wechat-group.png`。

## 测试/验证/验收方式

- `pnpm -C apps/landing tsc`：通过。
- `pnpm -C apps/landing lint`：0 errors，保留既有 `apps/landing/src/main.ts` 文件/函数过长 warning。
- `pnpm -C apps/landing build`：通过。
- 本地 Playwright 冒烟：`http://127.0.0.1:4173/zh/` 页面与弹窗均加载 `/contact/nextclaw-contact-wechat-group-2026-05-23.png`，图片尺寸 `1207 x 1732`。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths apps/landing/src/main.ts`：通过，非测试代码净增 `0`。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。

## 发布/部署方式

- 执行 `pnpm deploy:landing`，Cloudflare Pages 部署完成。
- 本次部署预览地址：`https://01c84282.nextclaw-landing.pages.dev`。
- 线上官网 `https://nextclaw.io/zh/` 已通过 Playwright 验证加载新二维码。

## 用户/产品视角的验收步骤

1. 打开 `https://nextclaw.io/zh/`。
2. 滚动到社群区域，或点击页面中的微信群入口。
3. 确认页面展示和弹窗中的二维码均为 2026-05-23 新二维码。
4. 打开 GitHub README，确认社群二维码引用 `images/contact/nextclaw-contact-wechat-group.png`，该资产已替换为新图。

## 可维护性总结汇总

- 本次是公开社群入口资产刷新，没有新增用户能力；源码只更新单一路径常量，避免引入并行二维码入口。
- 非测试代码增减为 `+1 / -1 / 0`，满足非功能改动净增不大于 0。
- 正向减债动作：复用现有 README 通用资产与官网 contact 资产目录，没有新增展示逻辑或重复组件。
- `apps/landing/src/main.ts` 仍是既有超长文件，需在后续 landing 重构中拆分文案、链接配置和渲染逻辑。
- 已使用 `post-edit-maintainability-review` 做收尾复核：本次无新增结构债务。

## NPM 包发布记录

不涉及 NPM 包发布。
