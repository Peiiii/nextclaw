# Browser Connector 彻底对齐 Codex 浏览器能力整改方案

## 背景

2026-06-07 的 Suno 真实会话证明，`browser-connector` 已经能在用户当前 Chrome 中完成连接、tab claim、页面 snapshot、结构化候选定位、`click --ref`、文本输入、生成和播放。但后续另一个会话在填歌词时仍然卡住：页面上歌词实际已经填入，字段计数也已经变化，模型却不信任 `page type` 的结果，转而尝试 `Meta+v` 剪贴板粘贴，随后被 `page.press` 的安全确认拦住。

这不是一个单纯的模型问题，也不是一句 skill 提醒能彻底解决的问题。它暴露的是当前 connector 与 Codex 浏览器能力的抽象层级差距：

- Codex 的浏览器 API 更接近 Playwright/locator：动作前能判断唯一性和可操作状态，动作后能做便宜、明确的状态读取。
- 当前 `browser-connector` 更接近低层 CLI 动作：能执行 `type/click`，但动作结果没有足够的页面事实证明，弱模型容易自行拼接观察、重试和绕路。

本方案目标不是复制 Codex 私有实现，而是对齐 Codex 对模型暴露出的外部能力合同和使用体验。

## 对齐目标

彻底对齐的定义不是“真实跑通过一次 Suno”，而是满足以下标准：

- 模型能在没有截图能力时完成常见网页任务。
- 模型不需要猜 selector、猜字段是否已写入、猜按钮是否可点。
- 每个写动作都能返回足够的状态证据，让模型知道下一步该继续、重试还是停下。
- 高风险动作仍然需要确认，不通过放宽安全策略来提升成功率。
- 真实用户 Chrome、登录态、tab 生命周期、安全边界仍然由 Browser Connector 管理，不引入独立 Playwright 浏览器替代。

## 当前已对齐能力

这些能力已经基本可用，不作为整改核心：

- 连接用户当前 Chrome，而不是新开独立浏览器。
- `tabs list/get/selected/open/claim/finalize` 主链路。
- `page snapshot` 与 `page snapshot --interactive`。
- `page locate --text`。
- `page click --ref`。
- viewport screenshot 输出到文件。
- extension capability discovery 与自 reload。
- 非 `http/https` URL 拦截。
- `page.press` 显式确认保护。
- 基础错误码：`UNSUPPORTED_COMMAND`、`PAGE_SCRIPT_FAILED`、`PAGE_SCRIPT_RESULT_MISSING`、`TAB_NOT_FOUND`、`NAVIGATION_TIMEOUT`。

## 未对齐清单

### P0：Verified Fill 缺失

Codex/Playwright 有 `locator.fill()`，并且模型可以马上读取字段状态。当前 `page.type` 只返回动作回执：

```json
{ "action": "page.type", "selector": "..." }
```

缺少：

- 实际写入后的 `value` / `textContent`。
- `valueLength`。
- `changed`。
- `matchedExpectedText`。
- 当前元素是否仍然 visible/enabled。
- 写入失败时的结构化失败原因。

这正是 Suno 歌词卡住的第一根因。

### P0：元素状态查询缺失

Codex locator 支持 `count()`、`isVisible()`、`isEnabled()`、`getAttribute()`、`textContent()` 等便宜状态检查。当前 connector 只能重新拿 snapshot，不能针对某个 selector/ref 单独查询。

缺少一个只读命令：

```bash
browser-connector page inspect --lease "<leaseId>" --ref "<ref>" --json
browser-connector page inspect --lease "<leaseId>" --selector "<selector>" --json
```

返回：

- `count`。
- `unique`。
- `visible`。
- `enabled` / `disabled`。
- `tagName`、`role`、`ariaLabel`、`placeholder`。
- `value` / `text` / `valueLength`。
- `checked` / `selected` / `editable`。
- `boundingBox`。

### P0：动作结果不带状态证据

Codex 的使用纪律是动作后采集最便宜的状态检查。当前 connector 把验证责任完全交给模型，导致模型在弱推理或上下文复杂时容易绕路。

需要让这些动作返回动作后的最小状态：

- `page fill`：返回字段状态。
- `page click`：返回点击目标状态和可选的 URL/title/text delta。
- `page scroll`：返回 `scrollX/scrollY/viewport`。
- `page wait`：返回匹配来源和匹配片段。

### P1：ref 不是稳定 DOM node id / locator

当前 `ref` 是一次 snapshot 中的 `i1/i2...` 序号，执行时再解析回 selector。它比猜 selector 好，但仍不等价于 Codex 的 locator 或 DOM node id。

问题：

- 页面变化后 ref 容易过期。
- 长 CSS path 在复杂 SPA 中脆弱。
- 无法表达“某个容器内的 Create 按钮”这类 scoped locator。

需要引入 locator-like 合同：

- `elementId`：一次 snapshot 内稳定，过期时明确报错。
- `selectorCandidates`：按稳定性排序，而不是只给一个 selector。
- `scopeRef`：允许在某个容器内 locate/click/fill。
- `stale` 错误：元素已不存在或已变化，要求重新 snapshot。

### P1：输入和点击保真度不够

当前 extension 通过注入脚本设置 value、dispatch `InputEvent/change`，点击则 dispatch mouse events 再调用 `element.click()`。这对很多页面足够，但不是完整浏览器输入语义。

需要优化：

- `fill` 使用 value setter，兼容 React/Vue/Svelte 受控输入。
- 对 contenteditable 使用 selection/range 写入。
- 写入后读回页面真实值。
- click 后检测元素是否 disabled、被遮挡、不可见或没有命中。
- 失败时返回 `ELEMENT_NOT_FOUND`、`ELEMENT_NOT_VISIBLE`、`ELEMENT_DISABLED`、`ELEMENT_NOT_EDITABLE`、`VALUE_NOT_CHANGED` 等明确错误。

### P1：wait/navigation 能力不足

Codex 有 `waitForURL`、`waitForLoadState`、`expectNavigation`。当前只有 `page wait --text`。

需要新增：

```bash
browser-connector page wait-url --lease "<leaseId>" --url "<url-or-pattern>" --json
browser-connector page wait-load --lease "<leaseId>" --state "load|domcontentloaded|complete" --json
browser-connector page wait-element --lease "<leaseId>" --text "<text>" --json
```

目标是让模型在点击 Create、登录跳转、表单提交、弹窗打开后有明确等待条件。

### P1：Dev Logs 缺失

Codex 有 `tab.dev.logs`。当前复杂 SPA 失败时，模型无法知道是页面 JS 报错、接口失败、按钮未命中还是状态未更新。

需要新增：

```bash
browser-connector page logs --lease "<leaseId>" --level error --limit 20 --json
```

范围只读、只返回当前 tab 可见运行日志，不读取 cookies/localStorage/sessionStorage。

### P2：Frame 与 scoped locator 缺失

当前命令默认只处理主 document。Codex 有 frame locator。真实网页遇到 iframe、嵌套编辑器、支付/登录组件时会弱。

后续需要：

- snapshot 标出 iframe。
- inspect/locate/click/fill 支持 `--frame-ref`。
- 不跨域读取敏感 frame 内部数据，失败时返回明确权限错误。

### P2：表单控件专用动作缺失

Codex 有 `check/setChecked/selectOption`。当前只能 click 或 press。

需要新增：

- `page check` / `page uncheck`。
- `page select`。
- `page set-value` 仅用于安全可编辑控件，不用于隐藏字段或敏感字段。

### P2：截图能力未完全对齐

当前有 viewport screenshot 和 output 文件。Codex 还有 fullPage/clip。

后续新增：

- `page screenshot --full-page`。
- `page screenshot --clip x,y,width,height`。

### P2：tab finalize/close 语义未完全对齐

Codex finalize 支持 keep/handoff/deliverable。当前 finalize 只释放 lease，不负责清理 agent 创建的临时 tab。

后续新增：

- `tabs finalize --keep handoff|deliverable|none`。
- `tabs close` 只允许关闭 connector 创建的 tab，或用户确认后的用户 tab。

### P2：Extension 版本合同漂移

NPM 包版本已到 `0.1.2`，extension manifest 仍为 `0.1.0`。虽然 capability discovery 能发现真实能力，但版本号会误导模型判断 reload 是否成功。

需要统一：

- package version。
- extension manifest version。
- status/setup/doctor 输出中的 version/capability 表述。

## 整改路线

### R1：Verified Fill 与 Inspect

目标：解决 Suno 歌词这类“实际已填入但模型不信”的根因。

新增命令：

```bash
browser-connector page inspect --lease "<leaseId>" --selector "<selector>" --json
browser-connector page inspect --lease "<leaseId>" --ref "<ref>" --json
browser-connector page fill --lease "<leaseId>" --selector "<selector>" --text "<text>" --reason "<why>" --json
browser-connector page fill --lease "<leaseId>" --ref "<ref>" --text "<text>" --reason "<why>" --json
browser-connector page fill --lease "<leaseId>" --selector "<editor-selector>" --mode paste --text "<text>" --reason "<why>" --json
```

`page fill` 成功返回示例：

```json
{
  "ok": true,
  "action": {
    "action": "page.fill",
    "selector": "textarea[data-testid=\"lyrics-textarea\"]",
    "element": {
      "unique": true,
      "visible": true,
      "enabled": true,
      "editable": true,
      "valueLength": 806,
      "preview": "[Intro]\\n金陵灯灭 是我亲手葬...",
      "matchedExpectedText": true,
      "changed": true
    }
  }
}
```

验收：

- 本地 demo input/textarea/contenteditable 均能 fill 并读回。
- Suno lyrics textarea fill 后返回 `valueLength > 0` 且 preview 包含歌词片段。
- V2EX 这类 editor-like 输入框可用显式 `--mode paste` 填入正文，并通过页面预览或 `pageTextMatched` 证明编辑器模型已接收文本。
- 不使用 OS 剪贴板或 `Meta+v` 绕过安全确认。
- 不要求 `page.press --confirmed`。

#### 2026-06-07 V2EX 修正结论：显式 Paste 输入原语

V2EX 真实验证暴露了一个不同于 Suno textarea 的输入层问题：对 `.CodeMirror textarea` 直接设值时，底层 textarea 的 `value` 可以变成目标文本，但 CodeMirror 可见文档和隐藏提交字段仍未更新；这会造成 `matchedExpectedText=true` 却无法预览正文的假阳性。

不应为 V2EX 或 CodeMirror 增加站点/框架特判。正确整改是补一个通用、显式、可验证的输入 primitive：

- `page fill` 默认 `--mode direct`，用于原生 input/textarea/contenteditable，保持最短、最可预测路径。
- `page fill --mode paste` 用于复杂编辑器或富文本输入，选择目标容器或其内部 editable receiver，派发浏览器标准 `beforeinput/paste/input/change` 事件，并在没有可观察匹配时使用同一输入动作内的 `insertText` 路径。
- action result 增加 `inputMode`、`receiver`、`pasteAccepted`、`pageTextMatched`，让模型判断“字段 value 匹配”和“页面/编辑器模型可见文本匹配”是否同时成立。
- Skill 规则改成：先 direct；若 action result 的字段证据与页面证据不一致，显式 retry `--mode paste`；之后用 `pageTextMatched`、`page inspect` 或 `page wait-element` 验证。
- 禁止把 OS clipboard、`Meta+v` 或站点特判作为隐藏 fallback。

真实验证边界：

- 干净 V2EX 发帖页从空白编辑器填写正文、选择 `sandbox`、点击 `预览主题` 已通过，预览正文包含目标文本，且没有点击 `发布主题`。
- 已有内容的 CodeMirror 文档上，合成 DOM 事件和合成 `selectAll` 快捷键仍无法保证替换旧正文，可能表现为追加。模型必须验证旧文本是否消失；若旧文本仍在，不能声称完成替换，更不能继续提交。
- 更彻底的 Codex 级替换能力需要真实浏览器输入通道，例如 Chrome Debugger/Input 级能力。但这会引入 `debugger` 高敏权限和重新授权成本，本批次不作为默认隐式能力引入。

### R2：动作后状态证据

目标：减少模型重复验证和错误重试。

增强：

- `page click` 返回目标元素点击前后的 `visible/enabled/text/ariaLabel`，以及 URL/title 是否变化。
- `page scroll` 返回 `scrollX/scrollY/viewportHeight/documentHeight`。
- `page wait` 返回匹配片段和匹配来源。

验收：

- 点击 Suno Create 后，能观察 credits、生成列表或按钮状态变化中的至少一种。
- scroll 后能看到 scrollY 变化。

### R3：Locator-like Ref

目标：减少复杂 SPA 中 selector 脆弱性。

增强 snapshot/locate：

- 返回 `elementId`。
- 返回 `selectorCandidates`。
- 支持 `scopeRef`。
- ref 过期时返回 `ELEMENT_STALE`。

验收：

- Suno 同名 `Create` 候选能用 `ariaLabel/boundingBox/scope` 消歧。
- ref 过期不会误点别的元素。

### R4：Wait 与 Dev Logs

目标：让模型能解释复杂页面失败。

新增：

- `page wait-url`。
- `page wait-load`。
- `page wait-element`。
- `page logs`。

验收：

- 点击导航类按钮后可等待 URL 或 load state。
- SPA 报错时能通过 logs 读到 error 级别摘要。

### R5：表单、frame、截图、tab 生命周期补齐

目标：补齐 Codex 体验长尾。

新增：

- `page check/uncheck/select`。
- iframe snapshot/locate/fill 支持。
- fullPage/clip screenshot。
- `tabs close` 与 finalize keep/handoff/deliverable。

验收：

- 安全 demo 覆盖 checkbox/select/iframe。
- 临时 tab 可由 connector 安全关闭。

## 不做事项

- 不把 `--key` 兼容成 `--keys`。这类末端 alias 会掩盖工具合同错误。
- 不放宽 `page.press` 对 `Meta+v` / `Enter` 等按键的确认要求。
- 不把 OS 剪贴板粘贴或 `Meta+v` 作为长文本输入主路径；复杂编辑器只使用显式 `page fill --mode paste`。
- 不新增 Suno 特判。
- 不开放任意写入式 `evaluate`。
- 不用独立 Playwright/Puppeteer 浏览器替代用户当前 Chrome。
- 不读取 cookies、localStorage、sessionStorage、密码、历史记录。

## 文档与 Skill 同步要求

每个整改批次完成后必须同步：

- `packages/browser-connector/README.md`：CLI 合同。
- `skills/browser-control/SKILL.md`：AI 使用顺序。
- `docs/plans/2026-06-07-browser-connector-codex-parity-review-plan.md`：对标矩阵状态。
- `docs/designs/2026-06-07-browser-connector-real-world-evaluation.md`：真实评估结果。
- `docs/logs/<version>-browser-connector-*/README.md`：代码/发布闭环记录。

Skill 的同步重点不应是“不要犯某个个案错误”，而应是把新的中层能力设为主路径：

1. locate/snapshot 找候选。
2. inspect 确认唯一性和可操作状态。
3. fill/click 执行动作。
4. 读取动作返回的状态证据。
5. 只有证据不足时再补 snapshot/screenshot。

## 测试与真实验收

### 单元测试

- CLI command registration 覆盖所有新增命令。
- fake IPC 覆盖 payload 和输出结构。
- extension 注入函数覆盖 input、textarea、contenteditable、disabled、hidden、ambiguous selector。
- 错误码覆盖 element not found、not visible、disabled、not editable、value not changed、stale ref。

### 构建验证

```bash
pnpm --filter @nextclaw/browser-connector tsc
pnpm --filter @nextclaw/browser-connector lint
pnpm --filter @nextclaw/browser-connector test
pnpm --filter @nextclaw/browser-connector build
node --check packages/browser-connector/resources/extension/background.controller.js
node --check packages/browser-connector/resources/extension/page-snapshot.utils.js
```

### 真实 Chrome 验收

必须在用户当前 Chrome 上跑：

- `status/setup/doctor` 能识别 capability 与 extension 版本。
- 本地 demo：input/textarea/contenteditable fill + inspect。
- 本地 demo：checkbox/select/button/scroll/wait。
- example.com：snapshot/screenshot/locate/read。
- Suno create：
  - locate lyrics textarea。
  - fill 完整歌词。
  - fill 返回 `valueLength` 和 preview。
  - locate `Create song`。
  - click 后通过 credits、生成列表或按钮状态确认进展。
  - 不使用 screenshot 和剪贴板也能完成。

## 发布闭环

涉及 `@nextclaw/browser-connector` 行为变化时：

- 增加 changeset。
- 构建并发布新的 NPM 版本。
- 确认 npm registry latest。
- 非仓库目录安装 smoke。
- 运行 `browser-connector setup chrome --json`。
- 用 `extension reload` 或用户一次性手动 reload 使 extension 能力生效。
- 更新并发布 `browser-control` marketplace skill。
- 安装 marketplace skill smoke，确认新流程可被 agent 读取。

## 成功标准

整改完成后，以下场景必须成立：

- 模型面对 Suno 歌词输入时，不需要猜“歌词有没有填进去”，因为 `page fill` 已返回字段事实。
- 模型面对 V2EX/CodeMirror 这类复杂编辑器时，可以显式选择 `page fill --mode paste`，并用页面文本或预览证明编辑器模型已更新。
- 模型面对多个 Create 时，不需要猜 CSS selector，因为 locate/inspect/ref/scope 能消歧。
- 模型不会把 OS 剪贴板 paste 当作普通 retry，因为复杂输入有显式、可审计的 paste 模式。
- 模型能通过 wait/logs 判断点击后页面是否真的发生变化。
- 如果失败，错误码能说明是元素找不到、不可见、禁用、不可编辑、ref 过期、页面脚本注入失败，还是网站自身状态阻塞。
- 与 Codex 的差距从“核心浏览器操作层不对齐”收敛为“少数高级长尾能力待增强”。

## 2026-06-07 落地记录

本方案已进入一次性落地批次，代码合同覆盖：

- `page inspect`：按 selector/ref 读取元素唯一性、可见性、可用性、可编辑性、value/text、checked/selected 和 bounding box。
- `page fill`：替换可编辑字段值，并返回 `valueLength`、`preview`、`changed`、`matchedExpectedText` 与元素状态。
- 动作后状态证据：`click/fill/check/uncheck/select/scroll/wait/logs` 返回可用于下一步判断的结构化状态。
- `page wait-url`、`page wait-load`、`page wait-element`。
- `page logs`：当前 tab 内轻量 console/error 捕获。
- `page check/uncheck/select`。
- `page screenshot --full-page` 与 clip 参数。
- `tabs close`：connector 打开的 tab 可关闭，用户既有 tab 需要 `--confirmed`。
- extension manifest 版本与当前 package 版本拉平到 `0.1.2`。

真实 Chrome smoke 已完成：

- 本地 demo 覆盖 `inspect/fill/check/select/click/logs/scroll/wait/screenshot/tabs close`。
- `page click` 已收敛为单次 DOM click 事件，修复了早期合成 click 与 `element.click()` 双触发导致 console log 出现两条的问题；最终 smoke 中 `clicked smoke button` 日志计数为 `1`。
- `page screenshot --full-page` 在加大 capture 间隔后通过真实 Chrome 限流验证，最终输出 `/tmp/browser-smoke-full-post-click-fix.png` 与 `/tmp/browser-smoke-clip-post-click-fix.png`。
- Suno create 页覆盖 lyrics textarea 的 `inspect/fill/restore`，证明字段事实可由 action result 直接返回，不需要截图或剪贴板 paste；最终 post-fix smoke 中原始 `valueLength=400`，填入 `Browser Connector post-fix Suno lyrics smoke` 后 `matchedExpectedText=true`，恢复后 `restoredToOriginal=true`。

可维护性收敛后追加验证：

- page action 注入从单个大函数改为 `page-action-dom.utils.js` + `page-action-runner.utils.js` 文件注入，再由 background 调用全局 runner，避免把全部 DOM helper 闭进一个超长函数。
- `page screenshot` 的 full-page/clip 拼接拆到 `page-screenshot.utils.js`，tab/url 格式化拆到 `browser-tab.utils.js`，CLI page 命令拆到 `register-browser-page-commands.ts`，parity 测试与 Native Host 测试独立成文件。
- post-refactor extension reload 后 capabilities 仍完整，`missingExtensionCapabilities=[]`。
- post-refactor 本地 demo 完整 smoke 通过：`clicked smoke button` 日志计数仍为 `1`，full-page 截图输出 `/tmp/browser-smoke-full-post-refactor.png`，clip 截图输出 `/tmp/browser-smoke-clip-post-refactor.png`。
- post-refactor Suno create 页再次通过 lyrics textarea `inspect/fill/restore`，原始 `valueLength=400`，填入 `Browser Connector post-refactor Suno lyrics smoke` 后 inspect 读回一致，恢复后 `restoredToOriginal=true`。
- V2EX clean compose smoke 通过：新开 `https://www.v2ex.com/new`，标题填入 `Browser Connector V2EX 草稿预览验证`，正文用 `page fill --mode paste` 填入三段真实换行文本，`pageTextMatched=true`，节点 `#nodes` 选择为 `sandbox`，定位确认 `预览主题` ref 为 `i92`、`发布主题` ref 为 `i91`，只点击 `i92` 后 `page wait-element` 等到预览正文 `我在测试复杂编辑器的显式 paste 输入模式`。未点击发布。
- V2EX replacement probe 也记录了当前边界：对已有 CodeMirror 内容重复 `page fill --mode paste` 仍可能追加旧内容；本批次不新增站点/框架特判，也不默认引入 Chrome `debugger` 高敏权限。Skill 已要求复杂编辑器替换必须验证旧文本消失，否则停止。
