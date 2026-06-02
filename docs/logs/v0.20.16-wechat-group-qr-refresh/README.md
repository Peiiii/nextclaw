# v0.20.16 WeChat Group QR Refresh

## 迭代完成说明

- 将 GitHub README 使用的通用微信群二维码资产 `images/contact/nextclaw-contact-wechat-group.png` 替换为 2026-06-03 收到的新二维码。
- 将官网 landing 的通用二维码资产 `apps/landing/public/contact/nextclaw-contact-wechat-group.png` 同步替换为同一张新图。
- 新增官网日期归档资产 `apps/landing/public/contact/nextclaw-contact-wechat-group-2026-06-03.png`。
- 将官网 landing 的二维码引用从 `2026-05-23` 切换到 `2026-06-03`，避免继续展示过期二维码。

## 测试/验证/验收方式

- `sips -g pixelWidth -g pixelHeight -g format images/contact/nextclaw-contact-wechat-group.png apps/landing/public/contact/nextclaw-contact-wechat-group.png apps/landing/public/contact/nextclaw-contact-wechat-group-2026-06-03.png`
  - 三个目标文件均为 `1207x1732` PNG。
- `pnpm -C apps/landing tsc`
  - 通过。
- `pnpm -C apps/landing lint`
  - 通过，无错误；保留历史 `apps/landing/src/main.ts` 超长 warning。
- `pnpm -C apps/landing build`
  - 通过，构建产物包含 `/contact/nextclaw-contact-wechat-group-2026-06-03.png`。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths apps/landing/src/main.ts`
  - 通过；非测试代码 `+1 / -1 / net 0`；保留历史文件预算 warning。
- `pnpm lint:new-code:governance`
  - 通过。
- `pnpm check:governance-backlog-ratchet`
  - 通过，ratchet status `OK`。
- `pnpm deploy:landing`
  - 通过，Cloudflare Pages 部署地址：`https://ea09b4c0.nextclaw-landing.pages.dev`。
- 线上验收：
  - `https://ea09b4c0.nextclaw-landing.pages.dev/assets/main-C0Xx1CeR.js` 包含 `nextclaw-contact-wechat-group-2026-06-03.png`。
  - `https://ea09b4c0.nextclaw-landing.pages.dev/contact/nextclaw-contact-wechat-group-2026-06-03.png` 返回 `HTTP 200` 与 `content-type: image/png`。
  - `https://nextclaw.io/zh/` 返回 `HTTP 200`。
  - `https://nextclaw.io/assets/main-C0Xx1CeR.js` 包含 `nextclaw-contact-wechat-group-2026-06-03.png`。
  - `https://nextclaw.io/contact/nextclaw-contact-wechat-group-2026-06-03.png` 返回 `HTTP 200`、`content-type: image/png`、`content-length: 510742`。
- `pnpm clean:generated`
  - 通过，生成产物状态干净。

## 发布/部署方式

- 官网 landing 已通过 `pnpm deploy:landing` 发布到 Cloudflare Pages。
- 正式域名 `https://nextclaw.io` 已验收到新二维码路径和图片资源。
- 不涉及后端、数据库、migration、远程 API、桌面端、NPM 包发布。

## 用户/产品视角的验收步骤

- 打开 GitHub README 的微信群二维码，应展示 2026-06-03 新图。
- 打开官网 `https://nextclaw.io/zh/` 或 `https://nextclaw.io/en/`，进入社群区域或点击微信群入口，应展示 `/contact/nextclaw-contact-wechat-group-2026-06-03.png`。
- 直接打开 `https://nextclaw.io/contact/nextclaw-contact-wechat-group-2026-06-03.png`，应能看到新二维码图片。

## 可维护性总结汇总

- 本次是社群入口资产刷新，不新增用户能力，不新增业务逻辑。
- 生产代码只替换一个静态资源路径，总代码与非测试代码均为 `+1 / -1 / net 0`。
- 未新增函数、分支、状态、fallback、目录层级或重复实现。
- 正向减债动作：复用既有通用资产路径和官网单一 `wechatGroupImage` owner，没有新增第二套展示链路。
- `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 已用于收尾判断；历史 landing 单文件超预算债务未在本次扩大。

## 红区触达与减债记录

### apps/landing/src/main.ts

- 本次是否减债：否
- 说明：该文件是历史超长 landing 单文件；本次只替换微信群二维码静态资源路径，未继续增加逻辑、分支、函数或状态。
- 下一步拆分缝：后续应将社群区块与下载区块从 `main.ts` 拆成独立 presenter/view 模块，再降低 landing 单文件体积。

## NPM 包发布记录

不涉及 NPM 包发布。
