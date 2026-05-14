# v0.18.44 WeChat Group QR Refresh

## 迭代完成说明

- 将 GitHub README 使用的稳定二维码资源 `images/contact/nextclaw-contact-wechat-group.png` 替换为 2026-05-14 收到的新微信群二维码。
- 将官网 landing 使用的微信群二维码切换到新的防缓存资源 `/contact/nextclaw-contact-wechat-group-2026-05-14.png`。
- 同步更新 landing 通用资源 `apps/landing/public/contact/nextclaw-contact-wechat-group.png`，保持稳定路径与带日期路径一致。

## 测试/验证/验收方式

- `shasum -a 256 apps/landing/public/contact/nextclaw-contact-wechat-group-2026-05-14.png apps/landing/public/contact/nextclaw-contact-wechat-group.png images/contact/nextclaw-contact-wechat-group.png`
  - 三个资源哈希一致：`ffb98ab3d878f089d756866cf216eec3ad4eece1bc24530d958e690eea9e9614`。
- `file apps/landing/public/contact/nextclaw-contact-wechat-group-2026-05-14.png apps/landing/public/contact/nextclaw-contact-wechat-group.png images/contact/nextclaw-contact-wechat-group.png`
  - 三个资源均为有效 PNG，尺寸 `1207 x 1732`。
- `rg -n "nextclaw-contact-wechat-group-2026-05-14|nextclaw-contact-wechat-group\\.png|WeChat Group|微信群" README.md apps/landing/src/main.ts`
  - README 继续引用稳定资源，landing 指向新的 2026-05-14 防缓存资源。
- `pnpm -C apps/landing tsc`
  - 通过。
- `pnpm -C apps/landing lint`
  - 通过，0 error；保留既有 `apps/landing/src/main.ts` 文件长度与 `render` 方法长度 warning。
- `pnpm -C apps/landing build`
  - 通过。
- `rg -n "nextclaw-contact-wechat-group-2026-05-14" apps/landing/dist`
  - 构建产物包含新资源路径。
- `shasum -a 256 apps/landing/public/contact/nextclaw-contact-wechat-group-2026-05-14.png apps/landing/dist/contact/nextclaw-contact-wechat-group-2026-05-14.png`
  - public 与 dist 中的新图片哈希一致。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths apps/landing/src/main.ts`
  - 通过，非测试代码净增 `0`；提示 `apps/landing/src/main.ts` 仍超过文件预算，这是既有红区。
- `pnpm check:governance-backlog-ratchet`
  - 通过。
- `pnpm lint:new-code:governance`
  - 被工作区已有未跟踪 `apps/pomodoro` 文件名阻塞；阻塞项不属于本次二维码改动。

## 发布/部署方式

- 本次未执行线上部署。
- 官网部署方式：后续按既有 frontend/landing 发布流程构建并部署 `apps/landing/dist`。
- GitHub README 展示随本次仓库提交生效。

## 用户/产品视角的验收步骤

- 打开 GitHub 仓库首页，确认 Community 区域的 WeChat Group 二维码显示为 2026-05-14 新图。
- 打开官网首页社群区域，确认微信群二维码资源请求路径包含 `nextclaw-contact-wechat-group-2026-05-14.png`。
- 扫码确认进入 `NextClaw 股东许愿 OpenClaw 交流群`。

## 可维护性总结汇总

- 本次遵循单一路径：README 使用稳定资源名，官网使用带日期资源名防缓存，未新增重复展示逻辑。
- 非测试代码净增 `0`，仅把 landing 常量从 2026-05-07 切换到 2026-05-14。
- 正向减债动作：复用既有稳定资源路径与既有防缓存命名策略，避免新增第二套社群入口配置。
- `post-edit-maintainability-review` 已用于收尾判断；`apps/landing/src/main.ts` 的文件体积红区为既有债务，本次未扩大。

## NPM 包发布记录

不涉及 NPM 包发布。
