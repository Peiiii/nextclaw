# v0.14.175-wechat-group-qr-refresh

## 迭代完成说明

- 将仓库 README 与中文 README 中的微信群二维码引用从旧 `.jpg` 切换为新的 [`images/contact/nextclaw-contact-wechat-group.png`](../../../images/contact/nextclaw-contact-wechat-group.png)。
- 将 landing 页微信群二维码静态资源引用切换为新的 `/contact/nextclaw-contact-wechat-group.png`，对应源码位于 [`apps/landing/src/main.ts`](../../../apps/landing/src/main.ts)。
- 同步把新二维码资源放入 landing 静态资源目录，并移除不再使用的旧 `.jpg`，确保官网构建与部署命中新图。

## 测试/验证/验收方式

- 构建验证：`pnpm -C apps/landing build`
- 冒烟验证：
  - `pnpm -C apps/landing preview --host 127.0.0.1 --port 4173`
  - `curl http://127.0.0.1:4173/zh/ | rg "nextclaw-contact-wechat-group\\.png"`
  - `curl -I http://127.0.0.1:4173/contact/nextclaw-contact-wechat-group.png`
- 文档验证：检查 [`README.md`](../../../README.md) 与 [`README.zh-CN.md`](../../../README.zh-CN.md) 中二维码引用均为 `.png`

## 发布/部署方式

- 执行 landing 发布：`pnpm deploy:landing`
- 本次 landing 部署地址：`https://4ed62cf6.nextclaw-landing.pages.dev`
- 本次不涉及 NPM 包发布、后端部署、数据库 migration。

## 用户/产品视角的验收步骤

1. 打开 GitHub 仓库首页，确认 README 中展示的是新的微信群二维码。
2. 打开中文 README，确认顶部“微信群”链接和正文二维码都指向新图。
3. 打开官网社区区域，确认微信群二维码已更新，点击二维码可打开新图片。
