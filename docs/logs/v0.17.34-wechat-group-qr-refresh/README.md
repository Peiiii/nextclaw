# v0.17.34 WeChat Group QR Refresh

## 迭代完成说明

- 将 GitHub README 使用的 `images/contact/nextclaw-contact-wechat-group.png` 替换为 2026-05-07 收到的新微信群二维码。
- 将官网 landing 使用的微信群二维码切换到 `apps/landing/public/contact/nextclaw-contact-wechat-group-2026-05-07.png`。
- 同步更新 `apps/landing/public/contact/nextclaw-contact-wechat-group.png`，保留通用路径可继续复用。
- 补充 `apps/landing/module-structure.config.json` 的 `main.ts` 根入口声明，让 landing 的真实 Vite 入口与 module-structure 合同一致。

## 测试/验证/验收方式

- `pnpm -C apps/landing tsc`
- `pnpm -C apps/landing lint`
- `pnpm -C apps/landing build`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths apps/landing/src/main.ts`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- 检查构建产物中包含 `/contact/nextclaw-contact-wechat-group-2026-05-07.png`，并确认 `apps/landing/dist/contact/nextclaw-contact-wechat-group-2026-05-07.png` 是有效 PNG。
- 线上验收 `https://a29d556d.nextclaw-landing.pages.dev/assets/main-DCojBDWZ.js` 包含 `nextclaw-contact-wechat-group-2026-05-07.png`。
- 线上验收 `https://a29d556d.nextclaw-landing.pages.dev/contact/nextclaw-contact-wechat-group-2026-05-07.png` 返回 `HTTP/2 200` 与 `content-type: image/png`。

## 发布/部署方式

- 官网 landing 已通过 `pnpm deploy:landing` 发布到 Cloudflare Pages：`https://a29d556d.nextclaw-landing.pages.dev`。
- 不涉及后端、数据库、migration 或远程 API 冒烟。

## 用户/产品视角的验收步骤

- 打开官网首页的社群入口，点击或查看微信群二维码，应展示 2026-05-07 新图。
- 打开 GitHub README 中的微信群二维码，应展示同一张新图。

## 可维护性总结汇总

- 本次是社群入口资产刷新，不新增用户能力，不新增业务逻辑。
- landing 代码只替换一个静态资源路径，非测试代码净增为 0。
- module-structure 配置只声明既有合法入口 `main.ts`，没有新增协议或放宽全局规则。
- 没有新增文件组织层级、函数、分支、状态或 fallback。
- 使用 `post-edit-maintainability-review` 做收尾复核。

## 红区触达与减债记录

### apps/landing/src/main.ts

- 本次是否减债：否
- 说明：该文件是历史超长 landing 单文件；本次只替换微信群二维码静态资源路径，未继续增加逻辑、分支、函数或状态。
- 下一步拆分缝：后续应将社群区块与下载区块从 `main.ts` 拆成独立 presenter/view 模块，再降低 landing 单文件体积。

## NPM 包发布记录

不涉及 NPM 包发布。
