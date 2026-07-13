# 产品截图与对外视觉资产自动化

## 目标

统一刷新官网、GitHub README 和用户文档使用的产品视觉素材。稳定页面由脚本批量生成；依赖代表性内容的真实任务由人选定输入、脚本完成采集；微信群二维码等外部时效资产走独立同步命令。

## 环境准备

```bash
pnpm install
pnpm exec playwright install chromium
```

截图默认使用雾蓝主题 `cool`、`1512 x 828` CSS 视口和 `2x` 输出，最终图片为 `3024 x 1656`。同一批公开素材不得混用主题。

## 稳定场景

使用确定性 mock 刷新全部稳定页面，适合 CI 和结构回归：

```bash
pnpm run screenshots:refresh
```

只刷新受本次变化影响的场景：

```bash
SCREENSHOT_SCENES=agents-en,agents-zh pnpm run screenshots:refresh
```

公开素材应优先连接真实本地 NextClaw 实例：

```bash
SCREENSHOT_USE_REAL_APP_DATA=1 \
SCREENSHOT_UI_ORIGIN=http://127.0.0.1:5194 \
SCREENSHOT_SCENES=providers-en,providers-zh \
pnpm run screenshots:refresh
```

真实模式不拦截 `/api/*`。需要会话路由的场景必须先确认脚本使用的 session 在该实例中存在；代表性真实任务优先使用下方精选模式。

稳定场景包括：

- `providers-en`、`providers-zh`
- `channels-en`、`channels-zh`
- `agents-en`、`agents-zh`
- `marketplace-skills`、`marketplace-skills-zh`
- `cron-jobs`、`cron-jobs-zh`
- `chat-home-en`、`chat-home-zh`
- `apps-panel-en`、`apps-panel-zh`
- `panel-app-running-en`、`panel-app-running-zh`
- `workspace-preview-en`、`workspace-preview-zh`
- `skills-detail-en`、`skills-detail-zh`

如需单独使用真实 marketplace：

```bash
REAL_MARKETPLACE=1 pnpm run screenshots:refresh
```

## 精选真实任务

图片生成、数据分析、代码、HTML 预览等宣传图的内容质量无法靠随机 mock 保证。先在真实本地实例中选定完整、可公开的 session，再执行：

```bash
SCREENSHOT_UI_ORIGIN=http://127.0.0.1:18888 \
SCREENSHOT_SESSION_ID=<real-session-id> \
pnpm run screenshots:capture-curated
```

默认更新：

- `images/screenshots/nextclaw-image-generation-result-en.png`
- `images/screenshots/nextclaw-image-generation-result-cn.png`
- `apps/landing/public/nextclaw-image-generation-result-en.png`
- `apps/landing/public/nextclaw-image-generation-result-cn.png`

可选参数：

- `SCREENSHOT_CURATED_ASSET=<kebab-basename>`：生成另一组精选资产。
- `SCREENSHOT_TARGET_TEXT=<unique-text>`：滚动到包含该文字的可见结果。
- `SCREENSHOT_TARGET_SELECTOR=<css-selector>`：复杂界面使用明确 CSS 选择器。
- `SCREENSHOT_SCENES=<asset-en,asset-zh>`：只生成一个语言版本。
- `SCREENSHOT_UI_THEME=natural`：明确需要默认主题时覆盖雾蓝；同批次不得混用。

精选模式强制使用真实 origin 和真实 session，不会启动 mock UI，也不会调用模型重新生成任务内容。

## 外部时效资产

更新微信群二维码时使用：

```bash
pnpm run assets:update-wechat-qr -- \
  --source <png-or-jpeg-path> \
  --date YYYY-MM-DD
```

命令会一次完成：

- 更新 GitHub/README 稳定资产 `images/contact/nextclaw-contact-wechat-group.png`。
- 更新 landing 稳定资产 `apps/landing/public/contact/nextclaw-contact-wechat-group.png`。
- 新增 landing 日期防缓存资产。
- 更新 `landing-route.utils.ts` 的实际引用。
- 验证三份 PNG 的尺寸和 SHA-256 一致性。

历史日期资产继续保留，因为迭代记录和短期缓存页面可能仍引用旧 URL。

GitHub Star 趋势图使用仓库自有静态 SVG，避免第三方实时图片接口的权限、限流或可用性变化影响 README：

```bash
GITHUB_TOKEN=$(gh auth token) pnpm run assets:refresh-star-history
```

脚本从 GitHub API 读取当前仓库的带时间戳 stargazer 数据，写入 `images/metrics/nextclaw-star-history.svg`。每周 workflow 使用 `github.token` 一并刷新并创建 PR；token 只作为 API 请求头使用，不写入图片或日志。

## 资产 owner

脚本稳定产出：

- `images/screenshots/*`
- `apps/landing/public/nextclaw-chat-page-*.png`
- `apps/landing/public/nextclaw-agents-page-*.png`
- `apps/landing/public/nextclaw-providers-page-*.png`
- `apps/landing/public/nextclaw-channels-page-*.png`
- `apps/landing/public/nextclaw-cron-job-page-*.png`
- `apps/landing/public/nextclaw-skills-doc-browser-*.png`
- `apps/landing/public/nextclaw-skills-page-*.png`
- `apps/landing/public/nextclaw-panel-apps-page-*.png`
- `apps/landing/public/nextclaw-panel-app-running-*.png`
- `apps/landing/public/nextclaw-workspace-preview-*.png`

精选真实任务产出：

- `nextclaw-hero-workbench-*.png`
- `nextclaw-image-generation-result-*.png`
- 以后通过 `SCREENSHOT_CURATED_ASSET` 增加的真实任务素材。

GitHub/文档源图放在 `images/screenshots/`，landing 使用的同名镜像放在 `apps/landing/public/`。两者必须哈希一致。

## CI

`.github/workflows/product-screenshots.yml` 每周和手动运行 stable 模式，并在资产变化时创建 PR。CI 不刷新精选真实任务或二维码，因为这两类素材需要明确的人类输入。

## 发布前验收

1. 根据本次 UI diff 只刷新受影响场景，不机械更新全部二进制文件。
2. 打开每张新图，确认真实、非空、有代表性，且完整显示文案声称的结果。
3. 检查密钥、token、私人标识、无关会话、失败提示、加载态和裁切。
4. 检查同批图片主题一致，标准截图尺寸为 `3024 x 1656`。
5. 用 `shasum -a 256` 检查 GitHub 源图与 landing 镜像。
6. 用 `rg` 检查 README、landing 和 docs 的实际引用没有指向旧资源。
7. 运行 `pnpm --filter @nextclaw/landing build`，并在本地页面打开实际图片入口。
8. 最后检查 `git diff --name-status`，不要混入本次视觉资产范围之外的工作区改动。
