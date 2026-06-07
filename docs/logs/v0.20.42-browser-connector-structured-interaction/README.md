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

## 测试/验证/验收方式

已执行：

- `pnpm -C packages/browser-connector test -- browser-connector-app.test.ts`
- `pnpm -C packages/browser-connector test`
- `pnpm -C packages/browser-connector tsc --noEmit`
- `node --check packages/browser-connector/resources/extension/background.controller.js && node --check packages/browser-connector/resources/extension/page-snapshot.utils.js`
- `pnpm -C packages/browser-connector lint`
- `pnpm -C packages/browser-connector build`
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

## 发布/部署方式

尚未发布。`@nextclaw/browser-connector` 已更新 package 版本与 changelog，后续按统一 NPM 发布流程进入发布闭环。

## 用户/产品视角的验收步骤

用户或 AI 在用户当前 Chrome 中操作复杂页面时，应按以下顺序验收：

1. `browser-connector extension reload --reason "refresh extension after update" --json` 可让已连接 extension 自 reload；若旧 extension 不支持该命令，则人工 reload 一次。
2. `browser-connector setup chrome --json` 返回 ready，且 extension capabilities 包含 `page.locate` 和 `extension.reload`。
3. `browser-connector page locate --lease "<leaseId>" --text "Create" --json` 返回可交互候选。
4. 对重复 `Create` 候选，按 `role/kind/text/boundingBox/visible/disabled` 选择目标。
5. `browser-connector page click --lease "<leaseId>" --ref "<ref>" --reason "<why>" --json` 成功执行。
6. 用 `page wait`、`page snapshot`、标题或 URL 变化验证结果。

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

## NPM 包发布记录

涉及 NPM 包发布：

- `@nextclaw/browser-connector`：需要 patch 发布，原因是新增公开 CLI 命令与行为合同。
- 当前状态：`package.json` 已更新到 `0.1.2`，待后续统一 NPM 发布流程发布。
