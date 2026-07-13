# 产品视觉资产刷新机制与 GitHub 展示更新

## 迭代完成说明

- 更新中英文 GitHub README 的产品定位、典型使用场景、安装入口、核心能力和真实界面截图，让仓库首页能够直接展示当前产品形态。
- 将图片生成代表图更新为最新真实实例截图，并保持 GitHub 源资产与 landing 镜像一致。
- 新增 `refresh-product-visual-assets` skill，把产品更新后的截图影响判断、真实数据选择、默认/雾蓝主题、镜像同步和视觉验收固化为可自动触发的流程。
- 在既有产品截图脚本中增加 `stable` 与 `curated` 两种模式。精选模式使用标准 `sid_` 会话路由，只接受真实本地实例，并要求目标元素出现在主内容区，避免把侧边栏标题误判为截图结果。
- 新增微信群二维码同步脚本，一次更新 GitHub 稳定路径、landing 稳定路径、日期防缓存路径和源码引用；本轮已同步 2026-07-14 收到的新二维码。
- 补全每周截图 workflow 可提交的 landing 镜像路径，稳定场景继续由 CI 自动刷新，精选任务和外部时效资产保留明确输入。

## 测试/验证/验收方式

- 新 skill 通过 `quick_validate.py`；三个触达脚本通过 `node --check` 与定向 ESLint，0 错误、0 警告。
- 精选截图反向验收：目标文字只出现在侧边栏时，脚本明确失败且不写入图片；正向验收：真实会话主内容目标成功生成 `3024 x 1656` 图片，GitHub 源图与 landing 镜像哈希一致。
- 二维码脚本将用户提供的 JPEG 规范化为 `1207 x 1732` PNG，三份目标资产 SHA-256 均为 `e07fa6291787a56a9f2e44fd96c416f24e8a8adc86597372a44608e3da2654a8`。
- `pnpm --filter @nextclaw/landing tsc` 与 `pnpm --filter @nextclaw/landing build` 通过；本地生产预览中的首屏、Agent、工作区、图片生成、Doc Browser 和二维码图片均以有效自然尺寸加载。
- `CI=true pnpm lint:new-code:governance` 与 `CI=true pnpm check:governance-backlog-ratchet` 通过。
- 定向 maintainability guard 为 0 错误、1 个历史超预算 warning；既有主截图脚本由 824 行降到 819 行，新增职责已进入独立子目录，没有继续扩大该文件的混杂程度。

## 发布/部署方式

- 官网通过 `pnpm run deploy:landing` 部署到 Cloudflare Pages，部署地址为 `https://c39cd22f.nextclaw-landing.pages.dev`，正式域名 `https://nextclaw.io` 已同步新构建。
- `https://nextclaw.io/zh/` 返回 200，线上主 bundle 引用 `nextclaw-contact-wechat-group-2026-07-14.png`。
- 正式域名上的新二维码与图片生成代表图均返回 200，下载哈希与仓库对应资产一致。
- GitHub README、官网视觉资产和截图自动化通过范围化提交进入 `master`。
- 本轮同时补入 `nextclaw` patch changeset；README 与视觉资产刷新会随下一次 NPM 正式版一起进入发布包。

## 用户/产品视角的验收步骤

1. 打开 `https://nextclaw.io/zh/`，确认首屏和主要能力区使用当前真实产品截图，没有空态、旧卡片消息或主题混用。
2. 滚动到“加入社群”，确认微信群卡片显示 2026-07-14 的新二维码；点击后可以打开完整原图。
3. 打开 GitHub 仓库首页，在中英文 README 中确认使用场景、桌面版/npm/Docker 安装入口、产品能力截图和微信群二维码均可见。
4. 后续产品界面变化时，直接触发 `refresh-product-visual-assets` skill；稳定页面批量生成，代表性会话只需提供真实 session id 和可选目标文字。

## 可维护性总结汇总

- 本轮新增的是可重复的产品视觉资产刷新能力，代码增长用于替代临时手工截图、逐处复制和依赖操作者记忆的流程。
- 浏览器截图仍由一个脚本入口负责；精选会话定位进入 `product-screenshots/curated-scenes.utils.mjs`，二维码同步进入 `visual-assets/update-wechat-group-qr.mjs`，没有建立第二套截图系统。
- 顺手删除了主脚本中的重复模式判断和环境变量解析，既有超预算文件净减少 5 行；新文件命名、角色和目录边界通过治理检查。
- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review`。主观复核无阻塞 finding；保留的观察点是主截图入口仍为历史超长文件，后续新增稳定场景时应继续把场景配置或远端 marketplace 处理迁入现有子目录。

## NPM 包发布记录

本轮新增 `nextclaw` patch changeset，用于确保正式发布后的 npm 包 README、安装入口、产品截图和社区二维码与 GitHub/官网保持一致。实际 NPM 发布版本、registry 验证和安装冒烟记录在本次正式发布完成后补入对应发布记录。
