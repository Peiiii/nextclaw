# 产品截图与外部资产

## 先判断是否刷新

读取本次 diff、release notes 或用户点名界面，列出受影响表面；用 `rg` 检查 README、landing、docs 和社交元信息中的当前引用。只刷新真实受影响场景，产品发布前至少检查首页首屏、主要功能图和 README 代表图。

## 稳定界面

Provider、渠道、Agent、技能市场、定时任务、面板应用和工作区预览等可稳定定位页面使用：

```bash
pnpm run screenshots:refresh
```

优先连接真实本地实例；只有 CI、结构回归或真实数据不可用时使用 mock：

```bash
SCREENSHOT_USE_REAL_APP_DATA=1 \
SCREENSHOT_UI_ORIGIN=http://127.0.0.1:<port> \
SCREENSHOT_SCENES=<scene-a,scene-b> \
pnpm run screenshots:refresh
```

## 精选真实任务

图片生成、数据分析、写作、代码或 HTML 结果先由人从真实本地数据中选定完整结果，再让脚本固定主题、语言、视口和镜像输出：

```bash
SCREENSHOT_UI_ORIGIN=http://127.0.0.1:<port> \
SCREENSHOT_SESSION_ID=<real-session-id> \
pnpm run screenshots:capture-curated
```

一个会话有多个候选时增加 `SCREENSHOT_TARGET_TEXT=<唯一文字>`。缺少真实 UI 或 session id 时直接失败，不回退到 mock，也不随机生成宣传内容。

## 外部时效资产

微信群二维码使用专门同步命令更新 GitHub 稳定路径、landing 稳定/日期路径和源码引用：

```bash
pnpm run assets:update-wechat-qr -- --source <image-path> --date YYYY-MM-DD
```

GitHub Star 趋势图由仓库脚本生成本地静态资产：

```bash
GITHUB_TOKEN=$(gh auth token) pnpm run assets:refresh-star-history
```

README 只引用 `images/metrics/nextclaw-star-history.svg`，不依赖第三方实时 SVG。

## 固定展示合同

- 正式产品截图使用默认或雾蓝主题，同批次不混用，默认 `cool`。主题专项 campaign 可使用用户明确指定的主题，但不得替换默认产品代表图的事实角色。
- 标准画布为 `1512 x 828` CSS 像素、`2x` 输出，即 `3024 x 1656`。
- 使用真实、非空、有代表性的数据；不得出现密钥、token、私人标识、无关会话、失败提示、加载态、调试工具或被裁断的关键结果。
- 产品截图必须来自真实运行界面；概念图、重排卡片或拼接图不能冒充产品截图。
- `images/screenshots/` 是 GitHub/文档源资产；landing 同名镜像必须与源资产哈希一致。
- 定时 CI 只刷新稳定场景。精选任务和外部时效资产需要明确输入，不加入无输入定时任务。

## 验收

1. 打开每张图检查构图、内容、隐私和主题，不只看脚本退出码。
2. 用 `sips` 检查尺寸格式，用 `shasum -a 256` 核对源资产与 landing 镜像。
3. 用 `rg` 检查 README、landing 和 docs 的实际引用。
4. landing 变更运行 `pnpm --filter @nextclaw/landing build`，并打开真实页面。
5. 运行触达脚本的 ESLint、skill validator 和治理检查；源码/脚本改动再进入 maintainability review。
6. 若图片绑定 changeset，运行 `pnpm release:summary -- --json` 核对语言、路径、替代文本和文件存在性。
7. 最后检查 `git diff --name-status`，未经用户要求不提交。

## 版本说明绑定

正式截图长期 owner 是 `images/screenshots/`，changeset 只保存机器可读引用：

```md
<!-- release-note-image: zh-CN | images/screenshots/<asset-cn>.png | 中文替代文本 -->
<!-- release-note-image: en-US | images/screenshots/<asset-en>.png | English alt text -->
```

完整场景和环境变量见 [`docs/workflows/product-screenshot-automation.md`](../../../../docs/workflows/product-screenshot-automation.md)。
