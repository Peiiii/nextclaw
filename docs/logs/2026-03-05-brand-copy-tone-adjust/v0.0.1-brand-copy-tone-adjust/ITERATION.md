# v0.0.1-brand-copy-tone-adjust

## 迭代完成说明（改了什么）

本次仅调整中文品牌文案，移除“神级”表达，统一为更稳妥的“数字世界全能管家”表述。

1. 更新中文 README 首屏一句话定位文案。
2. 更新 docs 中文首页 `hero.tagline` 文案。
3. 更新 landing 中文文案与 SEO 元信息（`title`、`description`、`og:*`、`twitter:*`、JSON-LD 描述）。
4. 更新功能全集文档中的一句话定位。

修改文件：

- `README.zh-CN.md`
- `apps/docs/zh/index.md`
- `apps/landing/src/main.ts`
- `apps/landing/zh/index.html`
- `docs/feature-universe.md`

## 测试/验证/验收方式

执行：

1. `pnpm build`
2. `pnpm lint`
3. `pnpm tsc`
4. `pnpm --filter @nextclaw/docs build`

验收点：

1. 全仓不再出现“专属神级管家”。
2. 中文 docs 首页文案显示“数字世界全能管家”。
3. landing 中文页面与 SEO 元信息文案同步更新。

## 发布/部署方式

仅文案与文档相关改动，无后端/数据库迁移。

1. 完成本地验证后执行：`pnpm deploy:docs`
2. 发布后检查：
   - `/zh/`
   - `/zh/guide/getting-started`

## 用户/产品视角的验收步骤

1. 打开中文 docs 首页，确认 Hero 文案不再含“神级”措辞。
2. 打开 landing 中文页，确认标题与描述均为“数字世界全能管家”语义。
3. 搜索站内主要入口文案，确认品牌语气一致且更克制。
