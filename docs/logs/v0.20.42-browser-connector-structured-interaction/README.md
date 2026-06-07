# v0.20.42 Browser Connector 结构化交互定位

## 迭代完成说明

本次迭代修复了真实 Suno 会话中 AI 在不依赖截图时难以定位底部 `Create` 按钮的问题。根因不是单纯模型能力不足，而是旧 `browser-connector` 合同只给粗粒度 `links/buttons/inputs` 与 CSS selector click，遇到自定义 button-like 元素和重复 `Create` 文本时，模型只能猜 selector。

已完成：

- 新增 `page snapshot --interactive`，返回 ref-addressable 交互候选。
- 新增 `page locate --text <text>`，按文本/aria/placeholder/role/kind 查找交互候选。
- 扩展 `page click`，支持 `--ref <ref>` 与 `--selector <selector>` 二选一。
- 新增 `extension reload`，允许 AI 通过 CLI 要求已连接的 unpacked extension 自 reload，并等待新 background 重新连接。
- 同步更新 `browser-control` skill、`@nextclaw/browser-connector` README、Codex 对标计划、真实评估集和结构化交互方案文档。
- 使用用户当前 Chrome 的 Suno create 页完成真实歌词闭环：定位歌词框、填入原创歌词、点击生成、生成新歌并启动播放。
- 补充 `page fill --mode paste` 显式输入模式，用于 V2EX/CodeMirror 这类复杂编辑器的空白正文输入，并在结果中返回 `inputMode`、`receiver`、`pasteAccepted`、`pageTextMatched`。
- 明确边界：复杂编辑器已有内容的强替换仍可能因非 trusted DOM 事件限制而追加，AI 必须验证旧文本消失；本批次不新增站点/框架特判，也不默认引入 Chrome `debugger` 高敏权限。

## 测试/验证/验收方式

已执行：

- `pnpm -C packages/browser-connector test -- browser-connector-app.test.ts`
- `pnpm -C packages/browser-connector test`
- `pnpm -C packages/browser-connector tsc --noEmit`
- `node --check packages/browser-connector/resources/extension/background.controller.js && node --check packages/browser-connector/resources/extension/page-snapshot.utils.js`
- `pnpm -C packages/browser-connector lint`
- `pnpm -C packages/browser-connector build`
- `pnpm --filter @nextclaw/browser-connector tsc`
- `pnpm --filter @nextclaw/browser-connector lint`
- `pnpm --filter @nextclaw/browser-connector test`
- `pnpm --filter @nextclaw/browser-connector build`
- `node --check packages/browser-connector/resources/extension/background.controller.js && node --check packages/browser-connector/resources/extension/browser-tab.utils.js && node --check packages/browser-connector/resources/extension/browser-commands.constants.js && node --check packages/browser-connector/resources/extension/page-action-dom.utils.js && node --check packages/browser-connector/resources/extension/page-action-runner.utils.js && node --check packages/browser-connector/resources/extension/page-screenshot.utils.js && node --check packages/browser-connector/resources/extension/page-snapshot.utils.js`
- `node packages/browser-connector/dist/app/main.js --version`
- `node packages/browser-connector/dist/app/main.js extension reload --help`
- `node packages/browser-connector/dist/app/main.js extension reload --reason "refresh extension after update" --json`
- `node packages/browser-connector/dist/app/main.js page click --lease lease-1 --reason "missing click target" --json`
- `node packages/browser-connector/dist/app/main.js setup chrome --json`
- `node packages/browser-connector/dist/app/main.js page locate --lease "<leaseId>" --text "Create" --json`
- `node packages/browser-connector/dist/app/main.js page locate --lease "<leaseId>" --text "朱颜换寂寥" --json`
- `node packages/browser-connector/dist/app/main.js page type --lease "<leaseId>" --selector 'textarea[data-testid="lyrics-textarea"]' --text "<原创歌词>" --json`
- `node packages/browser-connector/dist/app/main.js page click --lease "<leaseId>" --selector "#base-ui-_r_oh_" --json`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <touched browser-connector source files>`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `npm pack --dry-run`，确认 `@nextclaw/browser-connector@0.1.2` tarball 包含新版 `dist/extension/background.controller.js`。

结果：

- 单元测试、类型检查、lint、构建、extension JS 语法检查、治理检查均通过。
- `extension reload` 单元测试通过：CLI 会发送 `extension.reload`，收到 ack 后等待 `browserInstanceId` 从旧值变为新值。
- `setup chrome --json` 在能力不匹配时已优先提示 `browser-connector extension reload --reason "refresh extension after update" --json`，再提示旧 extension 不支持时人工 reload。
- 真实 live Chrome 验证边界：当前已加载 background 仍是旧命令集，执行 `extension reload` 返回 `UNSUPPORTED_COMMAND`；这证明第一次从旧版本跨到自 reload 能力仍需一次人工 reload。新能力进入 extension 后，后续 reload 可由 CLI 自触发。
- `page click` 缺少 `--selector/--ref` 时返回 `INVALID_ARGUMENT`。
- 真实 Chrome 连接侧：Native Host manifest、extension assets、native-host-ipc、chrome-extension 均为 true；`chrome-extension-capabilities=false`，因为当前 Chrome unpacked extension 尚未 reload 到包含 `page.locate` 的新 background。setup 已返回 reload 指引。
- 用户 reload unpacked extension 后，`setup chrome --json` 返回 ready，capabilities 包含 `page.locate`。
- Suno 真实歌词补验通过：`page type` 后页面显示原创歌词并从 `0/5000` 变为 `83/5000`；点击底部 `Create song` 后 credits 从 `520` 变为 `500`，列表出现 `朱颜换寂寥`、`春水向东流`；点击标题后顶部按钮暴露 `ariaLabel="Pause"`，证明播放态已启动。
- 发现的剩余缺口：旧 live extension 下 `click --ref` 会返回 `PAGE_SCRIPT_RESULT_MISSING`；源码已修复 ref click 为 background 侧重新 snapshot 后注入 selector click，并新增 `extension reload` 降低后续手动 reload 成本。若当前已加载 extension 旧到不支持 `extension.reload`，仍需一次人工 reload。部分 Suno 模式切换按钮对合成 click 状态反馈不稳定，后续应评估更高保真的输入动作 primitive。
- V2EX clean compose smoke 通过：新开 `https://www.v2ex.com/new`，标题填入 `Browser Connector V2EX 草稿预览验证`，正文用 `page fill --mode paste` 填入三段真实换行文本，`pageTextMatched=true`，节点 `#nodes` 选择为 `sandbox`；定位确认 `预览主题` ref 为 `i92`、`发布主题` ref 为 `i91`，只点击 `i92` 后 `page wait-element` 等到预览正文 `我在测试复杂编辑器的显式 paste 输入模式`。
- V2EX replacement probe 记录当前边界：对已有 CodeMirror 内容重复 `page fill --mode paste` 仍可能追加旧内容。Skill 已要求复杂编辑器替换必须验证旧文本消失，否则停止，不得继续发布/提交。

## 发布/部署方式

已发布：

- `@nextclaw/browser-connector@0.2.1` 已发布到 npm `latest`。
- `browser-control` marketplace skill 已执行 update，远端 `updatedAt=2026-06-07T14:40:30.614Z`。

## 用户/产品视角的验收步骤

用户或 AI 在用户当前 Chrome 中操作复杂页面时，应按以下顺序验收：

1. `browser-connector extension reload --reason "refresh extension after update" --json` 可让已连接 extension 自 reload；若旧 extension 不支持该命令，则人工 reload 一次。
2. `browser-connector setup chrome --json` 返回 ready，且 extension capabilities 包含 `page.locate` 和 `extension.reload`。
3. `browser-connector page locate --lease "<leaseId>" --text "Create" --json` 返回可交互候选。
4. 对重复 `Create` 候选，按 `role/kind/text/boundingBox/visible/disabled` 选择目标。
5. `browser-connector page click --lease "<leaseId>" --ref "<ref>" --reason "<why>" --json` 成功执行。
6. 用 `page wait`、`page snapshot`、标题或 URL 变化验证结果。
7. 对复杂编辑器空白正文，优先用 `page fill --mode paste` 并验证 `pageTextMatched` 或预览文本；对已有正文替换，必须额外验证旧文本不再出现。

Suno 歌词场景的可观察验收：

1. `page snapshot --interactive` 能看到 `textarea[data-testid="lyrics-textarea"]`。
2. `page type` 后页面正文包含目标歌词，字符计数变为非零。
3. 点击底部 `ariaLabel="Create song"` 后 credits 下降并出现新歌标题。
4. 点击新歌 `ariaLabel="Play <title> from start"` 后，页面出现 `ariaLabel="Pause"`。

## 可维护性总结汇总

本次是新增用户能力，生产代码存在合理增长。实现没有新增平行 runtime 或网站特判，而是收敛到现有 owner：

- CLI 参数继续由 `register-browser-connector-commands.ts` 负责。
- 读写边界继续由 `PageController` 与 `BrowserConnectorManager` 负责。
- 页面 DOM 候选生成继续由 extension snapshot 工具负责。
- 写操作安全门和 audit 仍沿用现有 `page click` 主链路。

维护性检查结果：

- `post-edit-maintainability-guard`：通过，0 error，4 warning。
- 源码/测试变更统计：新增 543 行，删除 35 行，净增 508 行。
- 非测试源码变更统计：新增 361 行，删除 33 行，净增 328 行。
- 追加 `extension reload` scoped maintainability：通过，0 error，3 warning；源码/测试新增 272 行、删除 4 行、净增 268 行，非测试新增 189 行、删除 2 行、净增 187 行。
- 这是新增用户可见 CLI 能力，非测试净增合理；实现已把 snapshot 基础信息和 interactive 候选拆成两个自包含注入函数，避免新增函数预算违规。
- 保留 watchpoint：`background.controller.js`、`register-browser-connector-commands.ts` 和测试文件接近预算；后续继续扩展 browser connector 时，应优先拆分 extension page action、page read 和 CLI page command registration。
- 追加 paste mode 补充后 maintainability guard 通过，0 error，3 warning；相关补充 diff 为 243 行新增、12 行删除，非测试净增 222 行。该增长属于新增公开输入 primitive 与真实验证纪律；保留 watchpoint：`page-action-runner.utils.js` 已接近 400 行预算，后续若继续增强输入保真度，应优先拆分 input strategy 或评估 Chrome Debugger/Input 级通用能力，而不是继续堆 DOM 合成分支。

## NPM 包发布记录

涉及 NPM 包发布：

- `@nextclaw/browser-connector`：需要 patch 发布，原因是新增公开 CLI 命令与行为合同。
- 当前状态：已发布 `0.2.1` 到 npm `latest`；`0.2.0` 曾短暂发布，但因包内 extension manifest 仍为 `0.1.2`，立即由 `0.2.1` 修正并覆盖为最新版本。
- registry 验证：`npm view @nextclaw/browser-connector version dist-tags --json` 返回 `version=0.2.1`、`latest=0.2.1`。
- 安装冒烟：在 `/tmp/browser-connector-install-smoke.*` 临时目录安装 `@nextclaw/browser-connector@0.2.1`，执行 `browser-connector --version` 返回 `0.2.1`，包内 `dist/extension/manifest.json` 版本也为 `0.2.1`。
- marketplace skill：`skills/browser-control` 本地校验通过，远端 `browser-control` 更新成功，远端字段包含双语 summary/description 且 `install.kind=marketplace`；非仓库临时目录安装冒烟成功。
