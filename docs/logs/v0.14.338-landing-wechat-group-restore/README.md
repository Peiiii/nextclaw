# v0.14.338 Landing WeChat Group Restore

## 迭代完成说明（改了什么）
- 修复 landing 首页“加入社群”入口误指向 QQ 群的问题：
  - 将 [`apps/landing/src/main.ts`](/Users/peiwang/Projects/nextbot/apps/landing/src/main.ts) 中的 `wechatGroupImage` 从 QQ 群二维码切回微信群二维码 `'/contact/nextclaw-contact-wechat-group.png'`。
  - 将首页 Hero CTA、社区区块、页脚入口的中英文文案统一从 `QQ群 / QQ Group` 改回 `微信群 / WeChat Group`。
  - 将社区说明与二维码标签同步修正，避免按钮、弹窗、社区 section 三处信息不一致。
- 为满足仓库治理规则，顺手把 `LandingPage` 中本次触达 class 的实例方法统一改为箭头 class field；仅为治理收尾，不改变页面行为。
- 同批次补充：将 landing/docs 站点实际使用的 `logo.svg` 叠加 `🐾` emoji（右下角），与当前前端品牌图标视觉保持一致。
- 同批次续改：为避免微信群二维码被 CDN / 浏览器缓存命中，新增带日期后缀的资源 [`nextclaw-contact-wechat-group-2026-03-31.png`](../../../apps/landing/public/contact/nextclaw-contact-wechat-group-2026-03-31.png)，并把 landing 页引用切换为 `'/contact/nextclaw-contact-wechat-group-2026-03-31.png'`；后续换码时只需新增新日期文件并更新常量。
- 同批次续改：将你提供的最新微信群二维码同步覆盖到仓库根资源 [`images/contact/nextclaw-contact-wechat-group.png`](../../../images/contact/nextclaw-contact-wechat-group.png) 与 landing 基础资源 [`apps/landing/public/contact/nextclaw-contact-wechat-group.png`](../../../apps/landing/public/contact/nextclaw-contact-wechat-group.png)，保证仓库 README 与落地页资源源头一致。
- 同批次续改：继续沿用日期后缀防缓存策略，新增 [`nextclaw-contact-wechat-group-2026-04-08.png`](../../../apps/landing/public/contact/nextclaw-contact-wechat-group-2026-04-08.png)，并将 [`apps/landing/src/main.ts`](../../../apps/landing/src/main.ts) 中的 `wechatGroupImage` 更新为 `'/contact/nextclaw-contact-wechat-group-2026-04-08.png'`。
- 同批次续改：将 [`README.md`](../../../README.md) 与 [`README.zh-CN.md`](../../../README.zh-CN.md) 的社群二维码入口统一改回微信群二维码，避免仓库首页和 landing 页对外展示的社群入口不一致。
- 同批次续改：继续使用你 2026-04-16 提供的最新微信群二维码覆盖仓库根资源与 landing 基础资源，并新增 [`nextclaw-contact-wechat-group-2026-04-16.png`](../../../apps/landing/public/contact/nextclaw-contact-wechat-group-2026-04-16.png) 作为新的防缓存 landing 入口；[`apps/landing/src/main.ts`](../../../apps/landing/src/main.ts) 中的 `wechatGroupImage` 同步更新为 `'/contact/nextclaw-contact-wechat-group-2026-04-16.png'`。

## 测试/验证/验收方式
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/landing tsc`
- 构建验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/landing build`
- 可维护性与新代码治理：
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：通过；仅保留历史性 warning，不属于本次新增阻塞项。
- 前端冒烟：
  - 本地预览：`PATH=/opt/homebrew/bin:$PATH pnpm -C apps/landing preview --host 127.0.0.1 --port 4173`
  - 页面可达：`curl -I http://127.0.0.1:4173/zh/`
  - 资源可达：`curl -I http://127.0.0.1:4173/contact/nextclaw-contact-wechat-group-2026-03-31.png`
  - 构建产物检查：`rg -n "WeChat Group|加入微信群|微信群二维码|nextclaw-contact-wechat-group-2026-03-31" apps/landing/dist -S`
  - 结果：中文首页预览返回 `200`，微信二维码带日期资源返回 `200`，构建产物命中微信文案与新资源路径。
- 本次二维码续改补充验证：
  - 哈希一致性：`shasum -a 256 /tmp/nextclaw-wechat-qr-import/1621775655482_.pic.jpg images/contact/nextclaw-contact-wechat-group.png apps/landing/public/contact/nextclaw-contact-wechat-group-2026-04-08.png`
  - Landing 资源可达：`curl -I http://127.0.0.1:4173/contact/nextclaw-contact-wechat-group-2026-04-08.png`
  - 引用检查：`rg -n "nextclaw-contact-wechat-group-2026-04-08|nextclaw-contact-wechat-group\\.png|WeChat Group|微信群" README.md README.zh-CN.md apps/landing/src/main.ts apps/landing/dist -S`
  - 结果：导入源图、仓库根二维码与 landing 新日期资源的 SHA-256 一致；landing 预览中的新资源返回 `200`；README 与 landing 构建产物均命中新二维码路径和微信群文案。
- 本次 2026-04-16 二维码续改补充验证：
  - 哈希一致性：`shasum -a 256 /tmp/nextclaw-wechat-qr-import-2026-04-16/source.jpg images/contact/nextclaw-contact-wechat-group.png apps/landing/public/contact/nextclaw-contact-wechat-group.png apps/landing/public/contact/nextclaw-contact-wechat-group-2026-04-16.png`
  - Landing 资源可达：`curl -I http://127.0.0.1:4173/contact/nextclaw-contact-wechat-group-2026-04-16.png`
  - 引用检查：`rg -n "nextclaw-contact-wechat-group-2026-04-16|nextclaw-contact-wechat-group\\.png|WeChat Group|微信群" README.md README.zh-CN.md apps/landing/src/main.ts apps/landing/dist -S`
  - 线上资源可达：`curl -I https://1fa92228.nextclaw-landing.pages.dev/contact/nextclaw-contact-wechat-group-2026-04-16.png`
  - 结果：导入源图、仓库根二维码、landing 基础资源与新的日期资源 SHA-256 一致；本地 preview 与已发布 Pages 资源均返回 `200`；README 与 landing 构建产物均命中新二维码路径和微信群文案。
- 图标资源检查（本次补充）：
  - `rg -n "🐾" apps/landing/public/logo.svg apps/docs/public/logo.svg`
  - 结果：两处 `logo.svg` 均命中 paw emoji 叠加层。

## 发布/部署方式
- 本次续改已按 landing 发布流程执行正式部署：
  - `pnpm deploy:landing`
  - Pages 部署结果：`https://1fa92228.nextclaw-landing.pages.dev`
  - 如需让仓库首页同步对外生效，再推送包含本次资源替换的 Git 提交。

## 用户/产品视角的验收步骤
1. 打开中文 landing 首页 `/zh/`。
2. 确认首页绿色按钮显示为“加入微信群”，而不是“加入QQ群”。
3. 点击该按钮，确认弹出的二维码为微信群二维码，且图片 URL 为带日期后缀的新地址。
4. 下滑到社区 section，确认左侧卡片标题为“微信群二维码”，页脚入口也显示“微信群”。
5. 英文页 `/en/` 同样确认对应入口显示为 `WeChat Group`。
6. 打开任一 landing/docs 页面标签页，确认浏览器页签图标为原图标叠加右下角 `🐾`。
7. 打开仓库 [`README.md`](../../../README.md) 与 [`README.zh-CN.md`](../../../README.zh-CN.md)，确认社群二维码均显示为最新微信群二维码，而不是 QQ 群二维码。

## 可维护性总结汇总
- 长期目标对齐 / 可维护性推进：本次不是新增用户能力，只刷新同一张微信群二维码在仓库与 landing 两个入口的统一展示；实现上沿用已有资源与常量结构，没有额外引入新模块、新分支或补丁式兜底，符合“统一入口、统一体验”的产品方向。
- 本次是否已尽最大努力优化可维护性：是。本次只保留了一个新的日期后缀静态资源文件，用于继续沿用既有的 CDN / 浏览器缓存规避策略；除此之外没有新增额外逻辑。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。代码层仅更新一个现有常量值，文档层只把仓库 README 的二维码入口收敛回微信群资源；没有新加 helper、组件或配置分叉。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：代码与分支数未恶化；文本改动仅为 README、迭代记录与一个常量替换。文件数净增 1 个是 landing 二维码日期资源，属于最小必要增长，用来避免旧二维码被缓存；同时偿还了“仓库 README 仍指向 QQ 群二维码、与 landing 展示不一致”的维护债务。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。本次没有新增抽象层，只复用现有 `wechatGroupImage` 常量和现有资源目录边界。
- 目录结构与文件组织是否满足当前项目治理要求：本次触达目录未新增结构性问题。`apps/landing/src/main.ts` 仍是历史超预算文件，但这次只改 1 行且未继续膨胀，后续仍应按既有 seam 继续拆分。
- 基于一次独立于实现阶段的 `post-edit-maintainability-review` 结论：通过。本次只是刷新同一张二维码资产并推进 landing 防缓存版本号，没有引入额外逻辑、分支或新抽象；唯一净增长仍是 1 个日期后缀静态资源文件，属于当前缓存策略下的最小必要成本。
