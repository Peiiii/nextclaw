# 不受支持的 UI 注入口与 NextClaw Skin Studio 设计

## 目标

NextClaw 要给高阶用户和社区作者保留一个类似 Codex Dream Skin 的定制逃生口，但不能把皮肤管理、素材分发、兼容维护和安全承诺塞进产品主干。

最终方案只有两层：

1. NextClaw 官方只提供一个固定、实验性、不受支持的同源 JavaScript 加载点。
2. Marketplace 用一个通用 Skill——`@nextclaw/nextclaw-skin-studio`——承接皮肤发现、预设选择、自定义、应用和恢复。

核心取舍是“一个口子 + 一个通用工具”，而不是在产品内建设皮肤系统，也不是每款皮肤发布一个 Skill。

## 设计原则

- **产品主干保持近乎零重量**：产品不知道皮肤名称、配色、素材、版本和选择状态。
- **能力完全解耦**：删除 Skill 和 `ui-inject.js` 后，产品回到没有皮肤能力的默认状态。
- **单一事实源**：活动实例只认 `$NEXTCLAW_HOME/ui-inject.js`。
- **单一变更入口**：Skin Studio 的 `scripts/skin.mjs` 是选择、定制、应用和移除的唯一写入口。
- **浏览器天然可用**：脚本由 NextClaw 服务同源加载，访问者不安装浏览器扩展。
- **明确不保证**：注入口不承诺安全隔离、DOM 稳定性、跨版本兼容或第三方皮肤质量。
- **安装不等于启用**：Marketplace 安装只下载 Skill；只有用户明确要求应用或定制时才写文件。

## 产品侧最小合同

- 活动文件：`$NEXTCLAW_HOME/ui-inject.js`。
- HTTP 入口：`GET /api/ui-inject.js`。
- 文件不存在：返回 `200`、JavaScript 内容类型和空内容。
- 文件存在：每次请求读取并返回当前内容。
- 缓存：固定 `Cache-Control: no-store`。
- 执行时机：React 主应用启动前加载。
- 生效方式：写入、切换或删除后刷新页面；不重启 NextClaw。
- 错误语义：只有 `ENOENT` 被解释为空脚本；权限、I/O 等真实错误继续可观察。

选择 `/api/ui-inject.js` 是为了让开发态复用 Vite 已有 `/api` 代理，桌面端、打包 UI、本机浏览器和远程浏览器共用同一条服务端链路。

## 用户如何发现和使用

### 发现与安装

用户在现有 Skill Marketplace 搜索：

- `NextClaw Skin Studio`
- `skin`
- `皮肤`
- `appearance`

安装 `@nextclaw/nextclaw-skin-studio` 后，可以直接对 Agent 说：

- “有哪些 NextClaw 皮肤？”
- “应用 Violet Orbit。”
- “基于 Glass Tide，把主色改成青色。”
- “当前用的是什么皮肤？”
- “恢复 NextClaw 默认界面。”

用户不需要记住文件路径或脚本命令。Skill 把自然语言映射到确定性脚本；脚本执行后只需要刷新当前页面。

### 直接命令

需要手动操作时，在已安装 Skill 目录执行：

```bash
node scripts/skin.mjs list
node scripts/skin.mjs status
node scripts/skin.mjs apply violet-orbit
node scripts/skin.mjs custom \
  --name Aurora \
  --base glass-tide \
  --accent '#14b8a6' \
  --secondary '#a855f7' \
  --background '#07111f' \
  --panel '#0f2033' \
  --text '#e6fffb'
node scripts/skin.mjs remove
```

非默认实例使用 `--home <NEXTCLAW_HOME>`。自定义皮肤还可通过 `--image <本地 PNG/JPEG/WebP>` 嵌入不超过 5 MB 的本地图片；图片会转成 data URL，不引入运行时网络依赖。

### 恢复与卸载

1. 先执行 `remove`，刷新后确认默认界面恢复。
2. 再从 Marketplace 卸载 Skill。

Marketplace 的通用卸载动作只删除 Skill 目录，不执行第三方卸载脚本，因此不新增皮肤专属卸载 hook。

## Skin Studio 结构

```text
nextclaw-skin-studio/
├── SKILL.md
├── marketplace.json
├── agents/
│   └── openai.yaml
├── assets/
│   ├── renderer.js
│   └── skins.json
├── references/
│   └── third-party-notices.md
└── scripts/
    └── skin.mjs
```

- `skins.json`：只保存预设皮肤数据。
- `renderer.js`：所有预设和自定义皮肤共用的渲染器。
- `skin.mjs`：负责列表、状态、选择、自定义、冲突保护和移除。
- `SKILL.md`：负责自然语言路由、风险提示和用户操作说明。

新增皮肤通常只新增一段预设数据，不复制脚本、不复制渲染器，也不新增 Marketplace 条目。

## 内置皮肤

首批提供六款：

| ID | 名称 | 方向 |
| --- | --- | --- |
| `abyssal-compass` | Abyssal Compass | 深海蓝、藏宝金与航海罗盘 |
| `portal-red` | Portal Red | 红白、柔和光环与现代产品感 |
| `rose-quartz` | Rose Quartz | 玫瑰粉、柔光花瓣与通透层次 |
| `glass-tide` | Glass Tide | 海盐青、玻璃水波与浅色工作台 |
| `violet-orbit` | Violet Orbit | 深紫宇宙、青色轨道与霓虹光晕 |
| `noir-gold` | Noir Gold | 黑金、放射刻线与克制电影感 |

这些皮肤借鉴 `Fei-Away/Codex-Dream-Skin` 的“外部工具定制宿主 UI”方法和视觉方向，但没有复制其角色、品牌或授权不清晰的图片。包内图形由 CSS/SVG 生成；来源和 MIT 许可说明记录在 `references/third-party-notices.md`。

## 状态、所有权与迁移

Skin Studio 写入的文件以严格 marker 开头：

```js
// nextclaw-ui-skin-owner: nextclaw-skin-studio
// nextclaw-ui-skin-id: violet-orbit
// nextclaw-ui-skin-version: 1
```

状态：

- `inactive`：文件不存在。
- `active`：文件明确属于 Skin Studio。
- `legacy`：识别旧 `abyssal-compass-theme` marker，可由新 Skill 覆盖或移除。
- `occupied`：文件属于其他工具或来源未知；拒绝覆盖和删除。

脚本不提供静默 `--force`。同一 owner 的重复应用幂等；写入先落临时文件再原子替换。旧 Marketplace 条目 `@nextclaw/abyssal-compass-theme` 已由 Skin Studio 替代并下架，旧注入文件仍可安全迁移。

## 端到端数据流

```text
Skill Marketplace
  -> 安装 @nextclaw/nextclaw-skin-studio
  -> 用户选择预设或给出自定义参数
  -> Agent 运行 scripts/skin.mjs
  -> 原子写入 $NEXTCLAW_HOME/ui-inject.js
  -> 浏览器请求 /api/ui-inject.js
  -> UI server 读取当前文件并 no-store 返回
  -> React 启动前执行渲染器
  -> 用户刷新后看到同一实例的当前皮肤
```

职责边界：

- `@nextclaw/server`：只负责加载活动文件。
- NextClaw UI：只负责在启动前请求固定入口。
- Marketplace：只把它当普通 Skill 分发和发现。
- Skin Studio：拥有皮肤预设、自定义输入、渲染器和文件生命周期。
- Agent：只在用户明确要求时执行写操作并解释刷新步骤。

## 浏览器和实例语义

- 皮肤安装在运行 NextClaw 服务的机器上，不安装在访问浏览器中。
- 桌面端、本机浏览器、远程浏览器和手机浏览器无需扩展。
- 一个 NextClaw 实例共用一个 `ui-inject.js`，该实例的访问者看到同一皮肤。
- 本方案不提供账号级、会话级或浏览器级个性化；这些能力会引入身份、持久化和缓存合同，不属于最小逃生口。

## Marketplace 列表一致性

皮肤可发现性依赖 Marketplace 自身行为正确，因此同时约束：

- “最近更新”使用独立的 `sort=updated&pageSize=6` 查询，不从相关性列表本地重排。
- “全部技能”显示服务端总数，不显示易误解的“已加载 / 总数”。
- 无限滚动必须一直加载到 `hasMore=false`，末页异常不能被首屏成功掩盖。
- UI 在重新挂载、重新联网、窗口聚焦和 30 秒轮询时刷新无搜索目录。
- NextClaw server 对历史 `builtin` 记录保持读取兼容，不能让一条旧记录使整个分页失败。
- Marketplace 官方公共查询只返回 `install.kind=marketplace`；`builtin` 不是可安装的公共商品。

### 国内镜像缓存策略

国内只读镜像仍需要缓存，以保证延迟和官方源短暂不可用时的可用性；问题不是“有缓存”，而是旧实现把原始 query 当键且永不过期。

修复后的合同：

- query 参数排序后再生成缓存键，同一请求只有一份缓存。
- 目录响应默认 TTL 为 10 分钟。
- 过期后优先刷新官方源。
- 只有刷新失败时才返回旧快照，并标记 `stale-if-error`。
- 首次请求没有缓存且官方源失败时返回明确 `502`，不伪造成功。

这对应成熟产品常见的“有限新鲜度 + stale-if-error”模式：缓存服务于韧性，不成为第二事实源。

## 安全与许可边界

`ui-inject.js` 在 NextClaw 页面同源上下文中执行，能够读取页面可访问数据、修改 DOM、发起同源请求，也可能破坏整个 UI。启用者自行承担安全性、可靠性和升级兼容风险。

Marketplace 上架不改变该能力的实验性质。Skill 必须：

- 应用前提示风险。
- 不联网下载并执行运行时代码。
- 不覆盖或删除未知 owner 的注入文件。
- 只分发作者拥有或有明确再分发许可的素材。
- 不把影视、游戏、名人或用户私有图片打包进公共预设。

## 明确不做

- 不增加 `nextclaw skin`、独立皮肤 CLI 或设置页面。
- 不增加皮肤 manifest、schema、数据库、资源后台或专门 Marketplace 类型。
- 不增加浏览器扩展。
- 不增加 Marketplace 卸载 hook。
- 不校验、不沙箱化、不转换任意注入脚本。
- 不承诺 DOM、CSS class、内部 API 或跨版本兼容。
- 不提供账号级、会话级或浏览器级皮肤选择。
- 不为旧 NextClaw 构建增加反向代理篡改、书签脚本等兼容旁路。

## 验收标准

### 产品注入口

1. 文件缺失时返回 `200` 空脚本，NextClaw 正常启动。
2. 运行中写入、切换和删除后，无需重启，刷新即生效。
3. 响应是 JavaScript 且 `Cache-Control: no-store`。
4. 非 `ENOENT` 读取错误可观察。
5. 开发态、打包浏览器 UI 和桌面 UI 共用同一入口。

### Skin Studio

1. Marketplace 元数据、Skill 结构和 JavaScript 语法校验通过。
2. `list` 返回六款预设；`status/apply/custom/remove` 行为可预测且幂等。
3. 未知 owner 冲突时逐字节保护原文件。
4. 旧 Abyssal marker 可由新 Skill 迁移或移除。
5. 预设和自定义图片都不依赖运行时远程资源。
6. 从正式 Marketplace 安装到仓库外临时目录后，与发布源一致。
7. 使用回装副本在隔离源码实例中真实显示至少两款皮肤，刷新切换、无需重启。

### Marketplace

1. 新 Skill 的详情、搜索、安装和最近更新排序正确。
2. 旧单皮肤 Skill 的公开详情为 `404`、搜索为零结果。
3. 无限滚动实际到达底部，最终加载数量等于总数，且没有末页错误或残留 loading。
4. 官方目录没有公共 `builtin` 条目；国内镜像过期目录会刷新而不是永久命中。

## 可维护性结论

产品主干仍只有“返回文件”和“启动前加载文件”两处最小改动。新增复杂度集中在可独立安装、更新和删除的 Skin Studio 中；预设是数据、渲染器是单一实现、脚本是唯一 owner。

Marketplace 是唯一发现与安装面，`skin.mjs` 是唯一状态变更面，`ui-inject.js` 是唯一运行时事实源。该结构符合 NextClaw“增强统一入口与生态编排，但不把所有功能硬塞进产品”的愿景。
