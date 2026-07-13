# 产品视觉资产刷新机制设计

## 背景

NextClaw 的产品界面、真实任务结果和社区二维码都会持续变化。当前稳定页面已经有批量截图脚本，但图片生成等代表性任务仍依赖临时操作，外部二维码也需要手工同步多个路径。结果是刷新速度依赖操作者记忆，容易出现主题不一致、截图不完整、镜像漏更新或官网仍引用旧资源。

## 现状依据

- `scripts/docs/refresh-product-screenshots.mjs` 已统一处理 Playwright、`1512 x 828` 视口、`2x` 输出、语言、主题、页面定位和多目标写入。
- `SCREENSHOT_USE_REAL_APP_DATA=1` 可以连接真实本地实例；默认模式使用确定性 mock，适合 CI。
- `nextclaw-image-generation-result-*` 等素材依赖真实任务内容，不能用固定 mock 代表，也不应在每次刷新时随机重新生成结果。
- README 使用 `images/contact/nextclaw-contact-wechat-group.png`，landing 同时维护稳定路径、日期防缓存路径和源码引用。
- `.github/workflows/product-screenshots.yml` 只适合无人工输入的稳定场景，不能可靠选择“最有代表性的真实任务”。

## 核心判断

最合适的机制不是追求所有图片全自动，而是把判断与执行拆开：

1. **skill 负责决策**：判断本次更新影响哪些图片、选择稳定场景或精选场景、约束真实数据和发布质量。
2. **脚本负责执行**：统一视口、主题、语言、定位、输出路径和镜像同步，避免每次重写 Playwright 操作。
3. **人只负责精选输入**：对内容质量高度敏感的真实任务，只指定代表性 session 或目标文本，不再手工处理截图细节。
4. **外部时效资产单独处理**：二维码不是产品 UI 场景，保留专门同步命令和日期防缓存合同，不混进截图定时任务。

## 推荐方案

### 统一 skill 入口

新增 `.agents/skills/refresh-product-visual-assets/SKILL.md`，覆盖产品更新、官网/README 截图刷新、真实实例截图和二维码替换等真实用户说法。skill 只保存工作流、选择规则和验收标准，不复制脚本实现。

### 扩展现有截图 owner

继续由 `refresh-product-screenshots.mjs` 作为唯一浏览器截图 owner，增加 `stable` 与 `curated` 两种模式：

- `stable` 是默认模式，保持现有批量场景和 CI 行为。
- `curated` 要求真实 UI origin 与 session id，定位真实任务中的完整结果，输出 GitHub 源图和 landing 镜像。
- 精选模式不提供 mock fallback，不负责生成任务内容，只负责可重复采集已选结果。

### 二维码同步命令

新增 `update-wechat-group-qr.mjs`：

- 接收 PNG/JPEG 源图和日期。
- 统一转换为 PNG。
- 同步 README 稳定资产、landing 稳定资产和 landing 日期资产。
- 更新 landing 的日期引用并检查写入结果一致性。

历史日期资源继续保留，因为迭代记录引用它们，且旧缓存页面可能短期继续请求旧地址。

### CI 边界

定时 workflow 继续只运行 stable 模式。补全它允许提交的所有脚本产出路径，但不纳入精选素材和二维码；后两者缺少明确输入时自动执行反而会降低宣传质量。

## Owner 与数据流

```text
产品更新 / 新二维码
  -> refresh-product-visual-assets skill（影响判断与流程选择）
  -> refresh-product-screenshots.mjs（稳定或精选 UI 截图）
  -> update-wechat-group-qr.mjs（外部二维码同步）
  -> images/screenshots 或 images/contact（GitHub/文档源资产）
  -> apps/landing/public（官网镜像）
  -> README / landing 源码引用
  -> 构建与视觉验收
```

截图脚本拥有浏览器采集合同；二维码脚本拥有外部二维码同步合同；skill 不直接改图片，CI 不替代内容精选。

## 目录组织

- 新 skill 放在 `.agents/skills/refresh-product-visual-assets/`，因为它是场景化 AI 执行入口。
- 设计依据放在 `docs/designs/2026-07-14-product-visual-asset-refresh.design.md`，与对外 README/官网隔离。
- 执行脚本继续放在 `scripts/docs/`，复用现有产品截图脚本边界；不新增第二套截图目录或抽象层。

## 验收标准

- skill frontmatter、命名和触发描述通过 validator。
- stable 默认运行范围不包含精选真实任务。
- curated 缺少真实 session 时明确失败；提供真实 session 后输出 `3024 x 1656` 图片并同步 landing 镜像。
- 二维码同步后三份 PNG 哈希一致，landing 引用切到当天日期路径。
- landing 构建通过，页面请求新二维码资源。
- 脚本 ESLint、governance、maintainability 检查通过。
- 最终人工检查代表图没有空态、裁切、隐私或主题漂移。

## 非目标

- 不自动决定哪个真实任务最有宣传价值。
- 不在截图刷新时调用模型随机生成新内容。
- 不把全部精选资产加入每周 CI。
- 不改写 README 或官网的产品文案。

## 后续实现顺序

1. 创建并验证 skill。
2. 为现有截图脚本增加 curated 模式和精选场景。
3. 增加二维码同步命令并更新本次资产。
4. 更新 workflow 文档与 CI 产出路径。
5. 用真实本地实例和 landing 构建完成验收。
