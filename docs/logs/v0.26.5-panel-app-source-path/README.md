# v0.26.5 Panel App 显式来源路径

## 迭代完成说明

- `show_panel_app` 新增可选绝对 `path`，在保留既有 `appId` 合同的同时，可以打开标准 Panels 目录之外的 `.panel.html` 文件或 `.panel` 目录。
- Kernel 构造的同一份 `panel_app` payload 同时供右侧栏和聊天内联卡片消费；两条展示路径都会保留来源路径，不再要求外部 Panel App 先复制进标准目录。
- 目录式外部 Panel App 的相对 CSS、JavaScript 和其它资源继续使用已有签名 asset token 链路；token 绑定实际来源路径，资源读取仍受相对路径安全校验约束。
- 相对来源路径在工具入口和 Kernel 来源 owner 两层均被拒绝，避免调用方工作目录不同造成不可预测解析。
- 根因是原有展示合同只有 `appId`，Kernel 来源解析固定从 workspace Panels 目录查找，UI 的 route、tab 和 inline view model 也没有携带来源路径。修复沿现有 `showContent -> PanelAppManager -> content/asset -> right-panel/inline` 主链路补充一个可选字段，没有新增第二套展示协议。

## 测试/验证/验收方式

- Kernel 定向测试：3 个文件、37 个用例通过，覆盖工具 schema、绝对/相对路径校验、外部单文件/目录内容读取和签名子资源加载。
- Server controller 测试：14 个用例通过，覆盖 content route 传递 `path`、错误状态映射，以及真实 Router → Manager → 外部目录 → 签名 asset route 的 assembled 边界。
- Agent Chat UI 定向测试：35 个用例通过，覆盖 inline markdown payload 保留路径。
- 主 UI 定向测试：6 个文件、24 个用例通过，覆盖 side panel、inline card、resource URI、content URL、history/equivalence 和 root-relative query 解析。
- `@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/agent-chat-ui`、`@nextclaw/ui` 的 package lint 均为 0 error；只剩与本次改动无关的既有 warning。
- 上述四个包的精确 `tsc` 均通过；Shared、Kernel、Server、Agent Chat UI 和主 UI 构建通过。
- 全仓 `pnpm build` 已执行并完成到 Desktop 前的包链；Desktop 因根构建顺序没有预先产出 `@nextclaw/kernel` 声明而失败。随后显式构建 Kernel 和缺失的 `@nextclaw/ncp-agent-runtime-next` 后，全部受影响包类型检查通过。
- `lint:new-code:governance`、governance backlog ratchet、generated-clean 与 `git diff --check` 通过。

## 发布/部署方式

- 新增 `.changeset/open-panel-app-source-path.md`，标记 `@nextclaw/shared`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/agent-chat-ui`、`@nextclaw/ui` patch。
- 本次只提交并合入本地 `master`；不 push、不建 PR、不发布 NPM 包、不部署、不执行 migration，也不重启现有 NextClaw 实例。

## 用户/产品视角的验收步骤

1. 在标准 Panels 目录之外准备一个 `.panel.html` 文件，或准备包含 `index.html` 与相对资源的 `.panel` 目录。
2. 调用 `show_panel_app`，传入稳定 `appId` 和该 Panel App 的绝对 `path`。
3. 确认右侧栏直接打开外部 Panel App，而不是提示标准目录中找不到该应用。
4. 在聊天消息的 `nextclaw-inline` payload 中使用相同 `appId + path`，确认内联卡片展示同一内容，展开后仍保留相同来源。
5. 对目录式应用确认相对 CSS/JavaScript 通过签名 asset URL 成功加载；传入相对 `path` 时应收到明确错误。

## 可维护性总结汇总

- 本次是新增用户能力，允许必要的生产代码增长；实现复用既有 `panel_app` payload、PanelApp source/content owner、签名资源 token、right-panel route 和 inline card，没有建立平行协议、fallback 或复制资源读取逻辑。
- 首轮 maintainability guard 发现 `PanelAppManager` 跨越 500 行预算，随后把“按标准 ID 或显式路径选择来源”的分支收敛到既有 content-source utility，Manager 回到 499 行，最终闸门为 0 error。
- 最终 guard 检查 31 个 TypeScript 文件：总代码 `+477 / -62 / 净增 415`，非测试代码 `+172 / -32 / 净增 140`；这是新增用户能力的必要合同、owner 与消费链路增长。目录 provider 例外、Panel App manager/test 和 chat message container 接近预算线属于 warning，均未新增生产文件或继续扩散目录结构。
- 主观复核结论：owner 边界保持清晰，路径是现有展示合同的可选来源身份；URL 生成集中到 right-panel resource helper，外部目录资源仍走统一签名 token 与相对路径约束。没有新增 React effect、生命周期 owner、adapter 或重复 manager。
- 可维护性复核结论：通过；no maintainability findings。首轮红线已通过职责收敛消除，剩余增长已达到当前能力合同的实际最小范围。

## NPM 包发布记录

- `@nextclaw/shared`：需要 patch，发布共享 `panel_app.path` 合同，待统一发布。
- `@nextclaw/kernel`：需要 patch，发布显式来源解析、工具 schema 与资源 token 支持，待统一发布。
- `@nextclaw/server`：需要 patch，发布 content route 的来源路径传递与错误映射，待统一发布。
- `@nextclaw/agent-chat-ui`：需要 patch，发布内联 payload 路径保留，待统一发布。
- `@nextclaw/ui`：需要 patch，发布 side panel、inline card 和 resource URI 的路径传播，待统一发布。
- Changeset：`.changeset/open-panel-app-source-path.md`。
- 本次未执行 NPM 发布。
