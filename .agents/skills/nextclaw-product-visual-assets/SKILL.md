---
name: nextclaw-product-visual-assets
description: 当 NextClaw 产品更新后需要重生成、替换或检查官网、GitHub README、用户文档中的产品截图、真实会话截图、功能演示图、社区二维码或其它对外视觉资产时使用；也用于用户提出“更新截图”“重新截一批图”“用真实实例生成图片”“同步 landing 与仓库图片”“更新微信群二维码”或发布前检查图片是否受本次变化影响。负责按资产类型选择自动或精选流程、保持默认/雾蓝主题与真实代表性数据、同步镜像并完成尺寸、引用、隐私和展示质量验收。
---

# 刷新产品视觉素材

## 目标

让产品更新后的对外图片刷新成为可重复流程。skill 负责编排和验收，仓库脚本负责确定性执行；不要靠临时截图步骤或逐处手工复制维持一致性。

开始前先使用 `user-facing-content-boundary`，确保最终图片只呈现产品结果，不把内部方案、调试状态或生产过程带到对外内容中。

## 先判断是否需要刷新

1. 读取本次 diff、release notes 或用户点名的界面，列出受影响的可见表面。
2. 用 `rg` 检查这些表面当前被 README、landing、docs 或社交元信息引用的图片。
3. 只刷新受到真实视觉或内容影响的场景；纯后端、协议或不可见重构不机械重截全套图片。
4. 产品发布前至少检查首页首屏、主要功能展示和 README 代表图是否仍与当前产品一致。

## 选择执行路径

### 稳定界面

适用于 Provider、渠道、Agent、技能市场、定时任务、面板应用、工作区预览等可稳定定位的页面。

```bash
pnpm run screenshots:refresh
```

公开素材优先连接真实本地实例；只有 CI、结构回归或真实数据不可用时才使用确定性 mock：

```bash
SCREENSHOT_USE_REAL_APP_DATA=1 \
SCREENSHOT_UI_ORIGIN=http://127.0.0.1:<port> \
SCREENSHOT_SCENES=<scene-a,scene-b> \
pnpm run screenshots:refresh
```

### 精选真实任务

适用于图片生成、数据分析、写作、代码或 HTML 结果等依赖代表性会话内容的场景。先在人类可判断的真实本地数据中选定一个完整结果，再让脚本完成主题、语言、视口、定位和镜像输出；不要让脚本随机生成宣传内容。

```bash
SCREENSHOT_UI_ORIGIN=http://127.0.0.1:<port> \
SCREENSHOT_SESSION_ID=<real-session-id> \
pnpm run screenshots:capture-curated
```

需要在一个会话中精确选择目标时，增加 `SCREENSHOT_TARGET_TEXT=<可唯一定位的文字>`。精选模式必须使用真实实例，缺少 session id 或真实 UI 时直接失败，不回退到 mock。

### 外部时效资产

微信群二维码等外部提供、会过期或需要防缓存的图片，不属于产品 UI 截图。使用专门同步命令更新 GitHub 稳定路径、landing 稳定路径、landing 日期路径和源码引用：

```bash
pnpm run assets:update-wechat-qr -- --source <image-path> --date YYYY-MM-DD
```

不要手工只覆盖其中一处。日期应使用收到并启用该二维码的当天日期。

GitHub Star 趋势图不再引用第三方实时 SVG。使用仓库脚本通过当前仓库的 GitHub Token 生成本地静态资产：

```bash
GITHUB_TOKEN=$(gh auth token) pnpm run assets:refresh-star-history
```

定时 workflow 使用 `github.token` 自动刷新该图；README 只引用 `images/metrics/nextclaw-star-history.svg`，避免第三方接口限流或权限变化导致图片失效。

### AI 辅助宣发视觉

适用于抽象能力、品牌叙事或单张产品截图难以承载的发布主结论。可直接用 AI 生图，也可把公开安全的真实截图作为输入，让 AI 生成背景、构图或视觉包装；执行时使用 `imagegen` skill，并保留原始截图作为事实对照。

- 若主结论是可见功能行为，优先让真实截图承担证据，AI 只做不遮挡关键界面的包装。
- 若主结论是性能数据，优先使用精确数据摘要图；AI 视觉只能辅助氛围，不能改写数字、平台、配置或测量边界。
- 若主结论是抽象能力或品牌叙事，可使用纯 AI 概念图，但必须在资产角色和对外文案中保持“概念视觉”语义，不得冒充产品 UI。
- 选择标准是信息表达和可信度，不建立“截图永远优先”或“AI 生图永远优先”的机械顺序。

## 固定展示合同

- 对外产品截图只使用默认主题或雾蓝主题；同一批次不混用主题，默认 `cool`。
- 标准画布为 `1512 x 828` CSS 像素、`2x` 输出，即 `3024 x 1656`。
- 使用真实、非空、有代表性的数据。截图要完整显示文案声称的对象和结果。
- 不得出现密钥、token、私人标识、无关会话、失败提示、加载态、调试工具或被裁断的关键结果。
- 产品截图必须来自真实运行界面；概念图、重排卡片或拼接图不能冒充产品截图。
- `images/screenshots/` 是 GitHub/文档源资产；landing 使用的同名镜像必须与源资产哈希一致。
- 为单个用户可见需求产出的正式截图，如果适合未来版本更新说明，必须通过 `release-note-image` 指令绑定到同一需求的 changeset；不要只把图片放进目录后期待发布时按文件名猜测。
- README 中的动态指标图使用仓库自有静态资产，并由 workflow 定期刷新；不得直接依赖需要公开 token 的第三方图片 URL。
- 定时 CI 只刷新稳定场景。精选真实任务和外部时效资产需要明确输入，不加入无输入的定时任务。

## 验收

1. 打开每张新图检查构图、主题、内容完整度和隐私，不只检查脚本退出码。
2. 用 `sips` 或等价工具检查尺寸与格式；用 `shasum -a 256` 检查源资产和 landing 镜像。
3. 用 `rg` 检查 README、landing 与 docs 的实际引用，确认没有仍指向旧资产。
4. 对 landing 变更运行 `pnpm --filter @nextclaw/landing build`，并在真实页面打开对应图片或入口。
5. 在 Validation 阶段运行触达脚本的 ESLint、skill validator 和治理检查；源码或脚本改动再进入 Review 阶段执行 maintainability 自动检查。
6. 若本次图片已绑定 changeset，运行 `pnpm release:summary -- --json`，确认语言、路径、替代文本和文件存在性全部通过。
7. 最后检查 `git diff --name-status`，只保留本次视觉资产机制和实际受影响图片；未经用户要求不要提交。

## 与版本更新说明关联

需求级截图的长期 owner 仍是 `images/screenshots/`，changeset 只保存机器可读引用：

```md
<!-- release-note-image: zh-CN | images/screenshots/<asset-cn>.png | 中文替代文本 -->
<!-- release-note-image: en-US | images/screenshots/<asset-en>.png | English alt text -->
```

仅在截图真实、公开安全、能直接证明需求价值时添加。完整发现、筛选、版本化复制和未采用原因由 `nextclaw-release-notes` 负责；本 skill 不生成最终 release note。

详细场景清单、环境变量和资产 owner 以 [`docs/workflows/product-screenshot-automation.md`](../../../docs/workflows/product-screenshot-automation.md) 为准。
