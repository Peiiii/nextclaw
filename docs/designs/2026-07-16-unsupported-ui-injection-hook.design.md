# 不受支持的 UI 注入口与 NextClaw Skin Studio 设计

## 目标

NextClaw 要给高阶用户和社区作者保留一个类似 Codex Dream Skin 的定制逃生口，但不能把皮肤管理、素材分发、兼容维护和安全承诺塞进产品主干。

最终方案只有两层：

1. NextClaw 官方只提供一个固定、实验性、不受支持的同源 JavaScript 加载点。
2. Marketplace 用一个通用 Skill——`@nextclaw/nextclaw-skin-studio`——承接皮肤发现、预设选择、个人皮肤工程创建、任意 CSS/JavaScript 打包、应用和恢复。

核心取舍是“一个口子 + 一个通用工具”，而不是在产品内建设皮肤系统，也不是每款皮肤发布一个 Skill。

## 设计原则

- **产品主干保持近乎零重量**：产品不知道皮肤名称、配色、素材、版本和选择状态。
- **能力完全解耦**：删除 Skill 和 `ui-inject.js` 后，产品回到没有皮肤能力的默认状态。
- **单一事实源**：活动实例只认 `$NEXTCLAW_HOME/ui-inject.js`。
- **单一变更入口**：Skin Studio 的 `scripts/skin.mjs` 是选择、定制、应用和移除的唯一写入口。
- **浏览器天然可用**：脚本由 NextClaw 服务同源加载，访问者不安装浏览器扩展。
- **明确不保证**：注入口不承诺安全隔离、DOM 稳定性、跨版本兼容或第三方皮肤质量。
- **安装不等于启用**：Marketplace 安装只下载 Skill；只有用户明确要求应用或定制时才写文件。
- **用户源码归用户**：个人皮肤放在 Skill 安装目录之外；Marketplace 更新可以替换工具，但不能覆盖用户的 CSS、JavaScript 和素材。
- **不给逃生口再造 API**：个人 `skin.js` 直接使用标准浏览器能力，不增加 Skin Studio DSL、组件白名单或 JavaScript API。

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
- “应用易烊千玺皮肤。”
- “应用桥本有菜皮肤。”
- “基于 Gothic Void Crusade，把主色改成青色。”
- “给我创建一个个人皮肤，把侧边栏变成卷轴，把工具过程做成时间线，加载图标换成水墨游龙。”
- “消息卡片还不对，直接改这个个人皮肤里的 CSS 或 JavaScript。”
- “当前用的是什么皮肤？”
- “恢复 NextClaw 默认界面。”

用户不需要记住文件路径或脚本命令。Skill 把自然语言映射到确定性脚本；脚本执行后只需要刷新当前页面。

### 直接命令

需要手动操作时，在已安装 Skill 目录执行：

```bash
node scripts/skin.mjs list
node scripts/skin.mjs status
node scripts/skin.mjs apply jackson-yee
node scripts/skin.mjs custom \
  --name Aurora \
  --base gothic-void-crusade \
  --accent '#14b8a6' \
  --secondary '#a855f7' \
  --background '#07111f' \
  --panel '#0f2033' \
  --text '#e6fffb'
node scripts/skin.mjs create-project "$NEXTCLAW_HOME/skins/my-skin" \
  --name "My Skin" \
  --base jackson-yee
node scripts/skin.mjs apply-project "$NEXTCLAW_HOME/skins/my-skin"
node scripts/skin.mjs remove
```

非默认实例使用 `--home <NEXTCLAW_HOME>`。一次性 `custom` 仍适合只改颜色和单张图片；需要持续创作、修复任意区域或加入动效时，使用独立个人皮肤工程。内置上游皮肤在用户明确应用时从固定 commit 下载一张图片、校验 SHA-256 后转成 data URL；也可用 `--source-dir <上游仓库克隆>` 完全从本地读取。浏览器生效后不再访问上游网络。

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
│   ├── foundation-styles.js
│   ├── navigation-styles.js
│   ├── content-styles.js
│   ├── control-styles.js
│   ├── renderer.js
│   └── skins.json
├── references/
│   ├── skin-authoring-and-repair-guide.md
│   └── third-party-notices.md
└── scripts/
    └── skin.mjs
```

- `skins.json`：只保存预设皮肤数据。
- `renderer.js`：所有预设和自定义皮肤共用的外置皮肤运行时；负责语义表面识别、动态节点生命周期、装饰资产和样式层装配。
- 四个 `*-styles.js`：依次负责基础画布、侧栏导航、内容消息和控件状态；共同使用一个运行时上下文，不创建平行皮肤 owner。
- `skin.mjs`：负责列表、状态、选择、个人工程创建、源码校验与装配、冲突保护和移除。
- `SKILL.md`：负责自然语言路由、风险提示和用户操作说明。

新增皮肤通常只新增一段预设数据，不复制脚本、不复制渲染器，也不新增 Marketplace 条目。

### 个人皮肤工程

个人皮肤不是新的产品主题系统，只是 Skin Studio 管理的一组用户源码：

```text
$NEXTCLAW_HOME/skins/my-skin/
├── skin.json
├── skin.css
├── skin.js
└── 本地图片、字体或其他素材
```

- `skin.json` 只负责选择一个内置 base，并可覆盖 token、人物裁切、标签、纹样和本地主图。
- `skin.css` 是原样追加到共享样式之后的任意 CSS，不限制选择器和视觉范围。
- `skin.js` 是原样在页面同源上下文执行的任意 JavaScript；没有 Skin Studio API、生命周期协议或组件白名单，作者直接使用 DOM、SVG、Canvas、事件和 `MutationObserver` 等标准浏览器能力。
- `create-project` 只创建上述用户源码；`apply-project` 做 JSON 结构校验、JavaScript 静态语法检查、本地图片内嵌和单文件装配，再原子替换活动 `ui-inject.js`。
- 生成文件不保存个人工程绝对路径。Marketplace 更新和 Skill 重装不触碰个人工程。

这条路径刻意接受“不安全、不稳定、不兼容”的高级用户逃生口属性。静态语法检查只避免明显的残缺 JavaScript 覆盖当前活动文件，不代表沙箱、安全审核或运行正确性保证。

### 外置皮肤运行时

外置运行时不能只把图片铺到页面后面。它在不修改 NextClaw 产品源码的前提下维护五层视觉合同：

1. 设计 token：颜色、字体、圆角、边框、阴影、透明材质与动效。
2. 语义表面：运行时识别 shell、sidebar、page、header、dock、session item、card、input、overlay 等稳定角色；SPA 跳转、懒加载和弹层挂载后重新识别。
3. 组件配方：按钮、链接、标签页、表单、选择器、开关、单选、列表、卡片、表格、代码块、工具过程、弹层、提示和加载态共用完整状态合同。
4. 页面配方：首页突出人物和签名；真实会话强调消息、代码、过程与输入器；技能市场强调筛选、分组和卡片；设置页强调表单分组与控件。
5. 独立装饰：人物、签名、折纸鹤、贴纸和运行指示器分层渲染，不把概念图里的假按钮、假文本或假列表当作真实 UI。

运行时以一个语义 owner 重新标记动态节点。每次扫描先建立本轮目标集合，只删除已经失效的旧标记；仍然成立的角色原地保留，避免动画、焦点或状态因“全删再加”被周期性重启。会话项只允许外层容器拥有背景、圆角和 hover，内部整行按钮保持透明，不再形成第二层表面；外层用单一色带、边框和阴影表达 hover / selected。原生加载图标可由皮肤配方替换为写意水墨圆势：粗细不均的未闭合墨环在末端汇成双叉火尾，以游龙而非具象龙头的方式沿圆周匀速运行；必须保留可访问名称和 reduced-motion 降级。

首页与真实会话的画布 owner 都是同时包含 header 与内容的 page section。人物、底色、纹样和渐变统一挂在这一共同父容器；header 本身透明、无独立背景/边框/阴影，避免把完整画布切成上下两块。会话人物层使用 `inset: 0` 覆盖完整可视画布，不再限制为右上角小矩形；左侧阅读渐变保护消息，人物从顶部延伸到输入器后方并在底部柔和淡出。主题身份不再额外生成固定胶囊 badge，减少漂浮表面和视觉噪音。

素材写入注入文件时仍使用 data URL，保证浏览器运行期不访问远程网络；渲染器加载后把内嵌 base64 转为同源 Blob URL，再写入 CSS 变量，并在运行时销毁时回收。这样既保持单文件交付，也避开浏览器对超大 CSS declaration 的静默丢弃，尤其覆盖约 3 MB 的 Jinx PNG。

## 内置皮肤

目录提供 11 款与 `Fei-Away/Codex-Dream-Skin` 源仓库逐项对应的皮肤：

| ID | 名称 | 方向 |
| --- | --- | --- |
| `jackson-yee` | 易烊千玺 · 清透定制 | 历史标签 `Jackson Yee`，当前素材为 `skin-04.jpg` |
| `arina-hashimoto` | 桥本有菜 · 浪漫玫瑰 | 当前正式 preset 纯背景 |
| `dilraba-violet` | 迪丽热巴 · 紫夜限定 | 历史标签 `Dilraba`，当前素材为 `skin-06.jpg` |
| `miku-cyan` | 初音未来 · 青蓝歌姬 | 历史标签 `Miku`，当前素材为 `skin-07.jpg` |
| `kun-noir` | KUN · 舞台黑金 | 历史标签 `KUN`，当前素材为 `skin-08.jpg` |
| `jinx-pop` | Jinx · 粉蓝涂鸦 | 当前 `jinx-codex.png` 概念图 |
| `enfp-spark` | ENFP · 灵感小宇宙 | 历史标签 `ENFP`，当前素材为 `skin-05.jpg` |
| `people-ai-red` | People AI · 红白科幻 | 历史标签 `People AI`，当前素材为 `skin-03.jpg` |
| `god-of-wealth` | 财神打工版 | 当前 `skin-02.jpg` 概念图 |
| `pink-custom` | 粉系定制 | 当前 `skin-01.jpg` 概念图 |
| `gothic-void-crusade` | Gothic Void Crusade | 当前正式 preset 纯背景 |

源版本固定为 `3af1d6d62f3a0388cc640d2f497ac3100998938e`；易烊千玺、迪丽热巴、Miku、KUN、ENFP、People AI 的历史实名标签由 `7777e9f601ccac2ec517eca6763d09496dbd7777` 证明。当前上游后来重排了画廊文件并移除了部分人物名，所以只审计当前 README 会漏项。

`Arina Hashimoto` 与 `Gothic Void Crusade` 使用上游纯背景；其余项目把上游整窗概念图仅作为人物、配色、纹样和材质的参考与裁切素材，再由共享运行时把设计语言应用到真实 NextClaw 组件，不把概念图里的假 UI 铺到页面后面冒充完成。Marketplace 包只分发目录、固定 URL、摘要与哈希，不二次打包人物/IP 图片。用户明确应用时才取回对应素材；下载失败或哈希不一致直接失败，不静默回退成抽象图案。

## 状态、所有权与迁移

Skin Studio 写入的文件以严格 marker 开头：

```js
// nextclaw-ui-skin-owner: nextclaw-skin-studio
// nextclaw-ui-skin-id: jackson-yee
// nextclaw-ui-skin-version: 3
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
  -> 用户选择预设，或让 Agent 创建/编辑独立个人皮肤工程
  -> Agent 运行 scripts/skin.mjs
  -> 内置皮肤校验固定上游图片；个人皮肤读取 skin.json/css/js 与本地素材
  -> 把共享运行时、任意个人 CSS/JavaScript 与资源装配成一个注入文件
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
- 个人皮肤目录：拥有用户持续创作的 CSS、JavaScript 和素材，不归 Marketplace 安装目录。
- Agent：只在用户明确要求时创建、编辑或应用个人皮肤，并解释刷新步骤与同源代码风险。

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
- 只在用户明确应用时下载固定上游图片，并在写入前校验 SHA-256；浏览器不直接加载远程资源。
- 不覆盖或删除未知 owner 的注入文件。
- 不把影视、游戏、名人或用户私有图片字节打包进 Marketplace 包。
- 人物和角色皮肤必须保留来源、非背书与权利边界，不能把仓库包含误表述为获得肖像、版权或商标授权。
- 明确区分“内置皮肤不执行远程代码”和“个人 `skin.js` 是用户本地提供的任意同源代码”；不能把前者误写成对后者的安全保证。

## 明确不做

- 不增加 `nextclaw skin`、独立皮肤 CLI 或设置页面。
- 不增加产品侧皮肤 manifest、数据库、资源后台或专门 Marketplace 类型；个人工程只保留 Skin Studio 自己的一份极小 `skin.json` 装配合同。
- 不增加浏览器扩展。
- 不增加 Marketplace 卸载 hook。
- 不沙箱化、不转换、不限制任意个人脚本；只在写入前做 JavaScript 静态语法检查，防止明显残缺源码替换当前皮肤。
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
2. `list` 返回 11 款与固定上游目录对齐的预设，并包含易烊千玺、桥本有菜、迪丽热巴、初音未来、KUN、Jinx 与 ENFP；`status/apply/custom/create-project/apply-project/remove` 行为可预测。
3. 未知 owner 冲突时逐字节保护原文件。
4. 旧 Abyssal marker 可由新 Skill 迁移或移除。
5. 内置皮肤只在显式 apply 时读取固定上游图片并校验哈希；下载/哈希失败不回退。生成的注入文件和自定义图片都不依赖浏览器运行时远程资源。
6. 从正式 Marketplace 安装到仓库外临时目录后，与发布源一致。
7. 使用回装副本在源码实例中逐款真实显示 11 款皮肤；用户要求本地真实数据时直接复用真实 `NEXTCLAW_HOME`、只隔离运行态，不复制少量会话冒充真实数据。
8. 在真实会话、技能市场、设置和首页检查 shell、header、navigation、session item、消息、代码、工具过程、表单、弹层、加载态、文字和人物/主视觉；验证 default/hover/focus/selected/disabled、窄屏、滚动和无横向溢出，刷新切换无需重启。
9. `create-project` 在 Skill 外创建可长期保存的 `skin.json`、任意 `skin.css` 和任意 `skin.js`；`apply-project` 能原样打包 CSS/JavaScript 和本地图片，不写入工程绝对路径，也不引入任何 Skin Studio JavaScript API。
10. 个人 JavaScript 语法错误时不覆盖当前注入文件；能通过语法检查不被表述为功能、安全或效果质量已经验证。

### Marketplace

1. 新 Skill 的详情、搜索、安装和最近更新排序正确。
2. 旧单皮肤 Skill 的公开详情为 `404`、搜索为零结果。
3. 无限滚动实际到达底部，最终加载数量等于总数，且没有末页错误或残留 loading。
4. 官方目录没有公共 `builtin` 条目；国内镜像过期目录会刷新而不是永久命中。

## 可维护性结论

产品主干仍只有“返回文件”和“启动前加载文件”两处最小改动。新增复杂度集中在可独立安装、更新和删除的 Skin Studio 中；预设是数据、渲染器是单一实现、脚本是唯一 owner。

Marketplace 是唯一发现与安装面，`skin.mjs` 是唯一状态变更面，`ui-inject.js` 是唯一运行时事实源。该结构符合 NextClaw“增强统一入口与生态编排，但不把所有功能硬塞进产品”的愿景。
