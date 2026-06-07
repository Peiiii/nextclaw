# Browser Connector Codex 对标审计与闭环落地计划

## 文档关系

本计划不是独立路线，而是对现有浏览器控制设计的执行层补充：

- 总设计文档：[浏览器控制能力完整闭环设计](../designs/2026-06-06-browser-control-capability-design.md)
- 真实评估集：[Browser Connector 真实场景评估集](../designs/2026-06-07-browser-connector-real-world-evaluation.md)
- 结构化交互定位方案：[Browser Connector 结构化交互定位方案](2026-06-07-browser-connector-structured-interaction-plan.md)

三份文档的职责边界：

- `2026-06-06-browser-control-capability-design.md` 负责回答“为什么要做、总体架构是什么、为什么采用 Chrome Extension + Native Host + CLI 路线”。
- 本计划负责回答“如何先对标 Codex 能力做系统审计，如何分级修复缺口，如何避免边测边补导致遗漏”。
- `2026-06-07-browser-connector-real-world-evaluation.md` 负责回答“真实 Chrome 中哪些场景必须跑通，如何打分，失败如何记录”。
- `2026-06-07-browser-connector-structured-interaction-plan.md` 负责回答“不靠截图时如何给 AI 提供可复用元素候选与 ref 操作合同”。

执行规则：任何后续实现、修复或验证结论，必须能回链到总设计的目标和本计划的对标审计项；真实验证结果必须更新评估集，而不是只写在聊天里。

## 文档同步合同

后续实现不能只改代码。每个任务包收尾时必须判断并同步更新相关文档：

- 总设计文档：当架构路线、安全边界、CLI 合同、Native Host/extension 职责或 NextClaw 集成边界变化时更新。
- 本计划：当 Codex 对标矩阵、P0/P1/P2/P3 分级、任务包范围或退出条件变化时更新。
- 真实评估集：当真实 Chrome 验证结果、失败 hop、评分、补验项或评估用例变化时更新。
- `browser-control` marketplace skill：当 CLI 命令、恢复步骤、安全纪律或 AI 使用顺序变化时更新。
- 迭代记录：当代码、脚本、测试、运行链路配置或实质交付结论变化时，按迭代留痕规则更新 `docs/logs`。

最终汇报必须明确说明哪些文档已更新、哪些文档不适用以及原因。

## 目标

把 `browser-connector` 从“基础链路能通”推进到“能力模型接近 Codex Chrome 插件路线、体验可被其他 AI 通过 skill/CLI 稳定复用”的完整闭环。

这次不是简单补几个命令，而是一次系统工程审计：

- 先对照 Codex Chrome 插件公开 API 文档和当前 `browser-connector` 实现，找出能力、字段、生命周期、错误语义和 AI 使用体验缺口。
- 再按真实用户路径优先级修复高价值缺口。
- 最后用真实 Chrome 评估集验证，而不是只靠单元测试宣布完成。

## 成功标准

完成时必须同时满足：

- Codex 对标审计表中 `P0` 和 `P1` 缺口已处理，或明确写出不可处理原因与替代合同。
- `browser-connector` 的 CLI JSON 输出能暴露足够状态，让 AI 判断当前能力是否匹配 extension 版本。
- tab 生命周期覆盖发现、打开、选择/获取、claim、页面操作、finalize 的主链路。
- 页面理解失败时返回明确错误码和恢复建议，不出现 `ok=true` 但没有页面数据的假成功。
- 真实评估集至少覆盖连接、tabs 盘点、新标签打开、公开页面理解、截图、表单输入、点击、lease 生命周期和高风险动作拦截。
- `browser-control` marketplace skill 的使用说明与真实 CLI 合同一致。
- 代码验证包含单元测试、类型检查、构建、真实 Chrome 冒烟和维护性收尾。

## 对标输入

### Codex 公开能力面

以本机 Codex Chrome 插件文档为参照，不复制私有代码：

- `~/.codex/plugins/cache/openai-bundled/chrome/<version>/docs/api.md`
- `~/.codex/plugins/cache/openai-bundled/chrome/<version>/docs/chrome-troubleshooting.md`
- `~/.codex/plugins/cache/openai-bundled/chrome/<version>/skills/control-chrome/SKILL.md`

参照重点不是内部实现，而是外部合同：

- `agent.browsers.get/list`
- `browser.user.openTabs/claimTab/history`
- `browser.tabs.new/list/get/selected/finalize`
- `tab.goto/reload/back/forward/close/title/url/screenshot`
- `tab.playwright` locator、wait、navigation、read-only evaluate
- `tab.dom_cua` visible DOM node id 操作
- `tab.cua` 坐标点击、拖拽、滚动、键盘输入
- `tab.dev.logs`
- capability discovery 和 troubleshooting 纪律

### 当前实现面

审计当前包：

- `packages/browser-connector/src/types/`
- `packages/browser-connector/src/controllers/`
- `packages/browser-connector/src/managers/`
- `packages/browser-connector/src/services/`
- `packages/browser-connector/resources/extension/`
- `packages/browser-connector/tests/`
- `skills/browser-control/`

## 缺口分级

- `P0`：会导致真实任务失败、误判成功、泄露敏感信息、无法恢复，或阻断 AI 自主完成主链路。
- `P1`：显著弱于 Codex 体验，会让 AI 经常绕路、猜测或依赖用户手工操作。
- `P2`：能力增强项，不阻断主链路，但影响复杂页面、调试效率或长期产品化。
- `P3`：未来路线，不进入本次闭环，但需要记录以免误以为已经实现。

## 对标审计矩阵

| 维度 | Codex 能力 | 当前状态 | 优先级 | 修复方向 |
| --- | --- | --- | --- | --- |
| 能力发现 | browser/tab capability collection | `status` 只返回连接和版本 | P0 | `extension.ready` 广播 protocol version 和 supported commands；`status/doctor/setup` 检测 CLI 与 extension 能力不匹配 |
| 当前 tabs | `browser.user.openTabs()`，含 title/url/lastOpened/tabGroup | `tabs list` 有 title/url/active/lastAccessed，tabGroup 缺失 | P1 | 保留当前字段，补 active/selected 入口；tabGroup 作为 P2 |
| 新建 tab | `browser.tabs.new()` 后返回可操作 Tab | `tabs open` 已补，但真实返回可能 title/url 为空 | P0 | extension 等待 tab 至少出现 url/title/status，再返回；超时返回明确 loading 状态 |
| 获取/选择 tab | `tabs.get(id)`、`tabs.selected()` | 缺失 | P1 | 增加 `tabs get`、`tabs selected`，减少 AI 猜 tabRef |
| tab 导航 | `goto/reload/back/forward/close` | 缺失 | P1 | 增加 `page goto/reload/back/forward`；`close` 默认只允许关闭 connector 创建或用户确认的 tab |
| finalize | 可清理不再需要的 tabs，支持 keep | 当前只释放 lease | P1 | 明确 finalize 语义；本轮至少暴露 lease 释放和旧 lease 不可用，tab 清理由后续确认策略承接 |
| 页面 DOM 理解 | `playwright.domSnapshot()`、locator、visible DOM | 当前 `page snapshot` 粗粒度 selector/text，且真实注入可能无结果 | P0 | 修复假成功，补明确错误码；审计注入失败根因；后续引入 visible DOM node id |
| 元素定位 | Playwright locator + DOM node id | 已补 `interactive` 候选、`page locate` 和 `click --ref`；CSS selector 仍保留 | P1 | 继续以结构化候选/ref 为主；DOM node id 或 locator API 作为后续 P2/P3 |
| 页面操作 | locator、DOM node、坐标 CUA | selector click/type/scroll/wait/press | P1 | 先稳定 selector 操作和 wait；坐标 CUA 作为 P2 |
| wait/navigation | `waitForLoadState/waitForURL/expectNavigation` | 只有 text wait | P1 | 增加 URL/load 状态 wait，操作后要求可观察验证 |
| 截图 | viewport/fullPage/clip，返回 bytes | viewport data URL | P1 | 增加 `--output`，保留 data URL；fullPage/clip 作为 P2 |
| console/dev logs | `tab.dev.logs` | 缺失 | P1 | 增加最小 console log 捕获或错误诊断，优先服务 snapshot 失败排查 |
| 错误语义 | troubleshooting 有明确恢复路径 | extension 侧多为 `IPC_REQUEST_FAILED` | P0 | 错误码分层：unsupported command、page script failed、missing result、tab not found、navigation timeout |
| 安全边界 | claim/finalize、确认、高风险操作纪律 | 已有 lease 和 press confirm，URL 脱敏已补 | P0 | 继续补 path token 脱敏、非 web URL 拦截、skill 禁止绕过 connector |
| AI 体验 | `agent.browsers.*` stateful facade | CLI + skill，AI 需 shell 调用 | P1 | 本轮继续 CLI-first；文档记录未来 MCP/JS client adapter，不提前耦合 NextClaw runtime |

## 闭环任务包

## 当前落地状态（2026-06-07）

- T2 已实现：extension ready 广播 `protocolVersion` 和 `capabilities`；`status/setup/doctor` 暴露 missing capabilities；真实 Chrome 已验证能识别 stale unpacked extension，并返回 `chrome-extension-capabilities=false` 与 reload 指引。
- T3 已实现源码与测试：新增 `tabs get`、`tabs selected`，`tabs open` 等待 tab 加载到可观察状态后返回，并返回 `status/pendingUrl`。
- T3 追加实现：`tabs open` 默认后台打开，用于临时读取/评估页面时不打断用户当前活动 tab；`--foreground` 仅用于用户明确要求切到新页面的场景，`--background` 保留为显式 no-focus 信号。
- T4 已实现源码与测试：新增 `UNSUPPORTED_COMMAND`、`PAGE_SCRIPT_FAILED`、`PAGE_SCRIPT_RESULT_MISSING`、`TAB_NOT_FOUND`、`NAVIGATION_TIMEOUT` 错误码，避免 snapshot/action 假成功。
- T5 已实现源码：snapshot 节点增加 `role/visible/disabled/unique`，继续保留不可信页面内容标记与截断。
- T6 已实现源码与测试：`page screenshot` 支持 `--output <file>`，默认可不回传大 data URL。
- T7 已完成核心真实验证：用户手动 reload 后，E00/E01/E02/E03/E04/E05/E06/E07/E09/E10/E11/E12 已跑通并回写评估集。
- 2026-06-07 追加修正：Suno 真实会话证明“复杂页面 selector 生成增强”仍不足以支撑无截图模型定位底部 Create 按钮；已补结构化交互方案，并实现 `page snapshot --interactive`、`page locate --text` 与 `page click --ref`。
- 2026-06-07 彻底对齐整改：Suno 歌词会话证明“动作执行成功”仍不足以让弱模型稳定推进；已新增 `page inspect`、`page fill`、动作后状态证据、`wait-url/wait-load/wait-element`、`page logs`、`check/uncheck/select`、full-page/clip screenshot 与 `tabs close`。
- 长期方向：DOM node id / scoped locator 仍可继续增强，但当前 P0/P1 主链路优先依赖 ref-addressable candidates、inspect 和 verified fill。

本状态表示本轮闭环达到可用标准；剩余 P2/P3 进入后续增强，不阻塞当前交付。

### T1 对标审计落盘

修改：

- `docs/plans/2026-06-07-browser-connector-codex-parity-review-plan.md`
- `docs/designs/2026-06-06-browser-control-capability-design.md`
- `docs/designs/2026-06-07-browser-connector-real-world-evaluation.md`

完成条件：

- 总设计、计划、评估集互相引用。
- 对标矩阵包含 Codex 能力、当前状态、优先级和修复方向。
- 已知真实评估发现同步进入计划，不只留在聊天记录。

### T2 协议版本与能力协商

修改：

- `packages/browser-connector/src/types/browser-connector-json.types.ts`
- `packages/browser-connector/src/types/browser-connector.types.ts`
- `packages/browser-connector/resources/extension/background.controller.js`
- `packages/browser-connector/src/services/native-host.service.ts`
- `packages/browser-connector/src/controllers/install.controller.ts`
- `packages/browser-connector/src/controllers/doctor.controller.ts`
- `packages/browser-connector/tests/browser-connector-app.test.ts`
- `skills/browser-control/SKILL.md`

要求：

- extension ready 消息必须包含 `protocolVersion` 和 `capabilities`。
- `browser.status --json` 返回当前 extension capability list。
- `setup chrome --json` 和 `doctor --json` 能判断 CLI 期望能力是否缺失。
- 缺失能力时给出明确 reload extension 指引。
- 同步更新总设计、真实评估集和 `browser-control` skill 中的版本/能力不匹配恢复说明。

验证：

```bash
pnpm --filter @nextclaw/browser-connector test
pnpm --filter @nextclaw/browser-connector build
node packages/browser-connector/dist/app/main.js status --json
node packages/browser-connector/dist/app/main.js setup chrome --json
```

### T3 tab 生命周期补齐

修改：

- `packages/browser-connector/src/app/register-browser-connector-commands.ts`
- `packages/browser-connector/src/controllers/tabs.controller.ts`
- `packages/browser-connector/src/managers/browser-connector.manager.ts`
- `packages/browser-connector/resources/extension/background.controller.js`
- `packages/browser-connector/tests/browser-connector-app.test.ts`
- `skills/browser-control/SKILL.md`

要求：

- `tabs open` 等待 tab 出现可观察 `url/title/status` 后返回。
- `tabs open` 默认后台打开临时页面，不切走用户当前 tab。
- `tabs open --foreground` 能显式切到新 tab。
- 增加 `tabs get <tabRef>`。
- 增加 `tabs selected`。
- 返回字段包含 `status` 和必要的 `pendingUrl`，但 URL 仍需脱敏。
- `tabs open` 继续拒绝非 `http:` / `https:` URL。
- 同步更新总设计的 CLI 合同、真实评估集 E01/E02/E11 和 `browser-control` skill 的 tab workflow。

验证：

```bash
node packages/browser-connector/dist/app/main.js tabs selected --json
node packages/browser-connector/dist/app/main.js tabs open "https://example.com/" --reason "parity smoke" --json
node packages/browser-connector/dist/app/main.js tabs get "<tabRef>" --json
```

### T4 页面理解错误语义修复

修改：

- `packages/browser-connector/src/types/cli-output.types.ts`
- `packages/browser-connector/resources/extension/background.controller.js`
- `packages/browser-connector/src/utils/error.utils.ts`
- `packages/browser-connector/tests/browser-connector-app.test.ts`
- `docs/designs/2026-06-07-browser-connector-real-world-evaluation.md`

要求：

- `page snapshot` 注入失败或无结果时返回稳定错误码，不允许假成功。
- extension 错误应尽量区分：
  - `PAGE_SCRIPT_FAILED`
  - `PAGE_SCRIPT_RESULT_MISSING`
  - `TAB_NOT_FOUND`
  - `UNSUPPORTED_COMMAND`
  - `NAVIGATION_TIMEOUT`
- 错误消息包含最小恢复建议，但不鼓励 AI 用 AppleScript、Playwright 独立浏览器或 macOS `open` 绕过 connector。
- 同步更新真实评估集中的 E03 结果和 skill 的故障排查说明。

验证：

```bash
node packages/browser-connector/dist/app/main.js page snapshot --lease "<leaseId>" --json
```

真实 Chrome 中必须覆盖 `https://example.com/` 和 `https://suno.com/`。

### T5 AI 操作用字段增强

修改：

- `packages/browser-connector/src/types/browser-connector.types.ts`
- `packages/browser-connector/resources/extension/background.controller.js`
- `packages/browser-connector/tests/browser-connector-app.test.ts`
- `skills/browser-control/SKILL.md`

要求：

- snapshot 中的 `buttons/inputs/links` 除 selector 外，尽量带：
  - visible text
  - aria label
  - placeholder
  - role
  - tagName
  - disabled/visible 简要状态
  - 候选唯一性提示
- 对页面文本继续截断，明确 `truncated`。
- 页面内容继续标记为不可信输入。
- 同步更新总设计的 snapshot JSON 合同、真实评估集 E03/E04/E05 和 skill 的元素选择策略。

验证：

```bash
node packages/browser-connector/dist/app/main.js page snapshot --lease "<leaseId>" --json
```

必须能让 AI 在安全 demo 页面中唯一定位输入框和按钮。

### T6 截图可消费性增强

修改：

- `packages/browser-connector/src/app/register-browser-connector-commands.ts`
- `packages/browser-connector/src/controllers/page.controller.ts`
- `packages/browser-connector/src/managers/browser-connector.manager.ts`
- `packages/browser-connector/tests/browser-connector-app.test.ts`
- `skills/browser-control/SKILL.md`

要求：

- `page screenshot` 支持 `--output <file>`，把 PNG 写入用户指定路径。
- JSON 输出仍包含 `mimeType`、tab 信息和输出路径。
- 默认不把大 data URL 写入普通文本日志；需要时仍可通过 `--include-data-url` 显式返回。
- 同步更新总设计的 screenshot JSON 合同、真实评估集 E07 和 skill 的截图使用方式。

验证：

```bash
node packages/browser-connector/dist/app/main.js page screenshot --lease "<leaseId>" --output /tmp/browser-connector-smoke.png --json
```

### T7 真实评估闭环

修改：

- `docs/designs/2026-06-07-browser-connector-real-world-evaluation.md`
- `docs/logs/v0.20.40-browser-connector/README.md`

要求：

- 按 E00-E12 至少跑核心路径：
  - E00 连接与恢复
  - E01 tabs 盘点
  - E02 新标签打开
  - E03 公开页面理解
  - E04 表单输入
  - E05 点击状态变化
  - E07 截图视觉判断
  - E09 高风险动作拦截
  - E10 非 web URL 拦截
  - E11 lease 生命周期
  - E12 自然语言真实任务闭环
- 每个低分项写第一个失败 hop。
- 真实 Chrome 验证失败时，不得用单元测试替代宣布通过。
- 评估结果必须回流本计划；若发现新的 P0/P1，先更新对标矩阵再修复。

## Review-first 执行纪律

执行顺序固定：

1. 先按本计划完成静态对标 review，更新 findings。
2. 再修 P0。
3. P0 清零后修 P1。
4. P1 修完再跑真实评估集。
5. 评估集发现新 P0/P1 时，回到对标矩阵，不直接零散补丁。

每次修复前都要先判断：

- 是否新增用户能力；
- 是否可以删除或收敛旧路径；
- owner 是 extension、native host、CLI controller、manager、skill 还是评估文档；
- 最小真实验证是什么。

## 不做事项

本闭环不做：

- 复制 Codex 私有 extension、native host 或 `browser-client` bundle。
- 把能力耦合进 NextClaw runtime/kernel/UI。
- 用 Chrome DevTools MCP 取代 first-party connector。
- 用 Playwright/Puppeteer 新开浏览器冒充用户当前 Chrome。
- 读取 cookies、localStorage、sessionStorage、密码或浏览器历史。
- 在未确认时执行提交、付款、删除、上传、发送、安装等高风险动作。

## 最终退出条件

任务只有在下面全部成立时才算完成：

- 文档：总设计、计划、评估集互相引用且内容一致。
- 代码：P0/P1 修复完成，CLI/extension/native host 合同一致。
- Skill：`browser-control` 指令与实际命令一致，能指导 AI 自己恢复常见问题。
- 测试：包级测试、build、TypeScript 检查通过。
- 真实验证：评估集核心用例完成并记录结果。
- 可维护性：完成代码增减、非测试代码增减、正向减债动作、治理检查和迭代记录更新。
