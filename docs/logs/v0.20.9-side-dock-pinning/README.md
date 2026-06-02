# v0.20.9 SideDock Pinning

## 迭代完成说明

本次在 SideDock 第一版基础上补齐“把当前右侧栏资源固定到快捷栏”的闭环，并同步更新设计文档 `docs/designs/2026-06-02-side-dock-design.md`。

关键完成项：

- SideDock 业务模型从 `labelKey` 收敛为最终 `label: string`，manager / store / persisted payload 不感知 i18n key。
- DocBrowser tab 增加 `resourceUri`，区分当前渲染地址 `currentUrl` 与可 pin、可恢复、可去重的资源身份。
- right-panel-resource route target 增加 `resourceUri`，docs、Apps、Service Apps、Panel App 都能产生稳定资源身份。
- DocBrowser 顶部增加固定 / 取消固定按钮，内置入口显示已固定但不可取消。
- SideDock 用户 pin 项支持轻量 unpin，内置入口仍不可 unpin。
- Panel App 的 `nextclaw://panel-app/<id>` 可恢复为 `/api/panel-apps/<id>/content` 打开路径。
- Panel App 固定到 SideDock 时保留自身图标；图片图标保存为 url icon，emoji / 单字符 / 短文本图标保存为 text icon，避免全部退化成通用应用图标。
- 修复 Panel App 页面经过 DocBrowser 顶层返回历史恢复时，把 `/api/panel-apps/<id>/content` 误当成 `nextclaw://panel-app/<id>` 解析的问题；active history 现在保存 `resourceUri`，resolver 也能幂等识别 Panel App content URL。

本次返回历史问题的根因：

- DocBrowser 顶层 active history 之前只保存 `kind/tabId/url`。
- Panel App 的 `url` 是实际渲染地址 `/api/panel-apps/<id>/content`，不是稳定资源身份。
- 返回恢复时因为 `kind = panel-app`，route resolver 会走 panel-app route，并把 path 第一段当成 app id，导致 `/api/panel-apps/demo/content` 被误读出 `api`，进而请求 `/api/panel-apps/api/content`。
- 修复点放在正确 owner：DocBrowserManager 保存/恢复稳定 `resourceUri`，right-panel-resource route resolver 对 content URL 做幂等解析，后端 panel app id 校验不需要放宽。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test src/features/side-dock src/features/right-panel-resources src/shared/components/doc-browser`
  - 结果：7 个测试文件、48 个测试通过。
- `pnpm --filter @nextclaw/ui test -- src/features/right-panel-resources/utils/right-panel-resource-route-resolver.utils.test.ts src/shared/components/doc-browser/doc-browser-context.test.tsx`
  - 结果：2 个测试文件、22 个测试通过；覆盖 `nextclaw://panel-app/<id>` 与 `/api/panel-apps/<id>/content` 等价解析，以及 Panel App -> New Tab -> 返回的历史恢复路径。
- `pnpm -C packages/nextclaw-ui tsc`
  - 结果：通过。
- `pnpm --filter @nextclaw/ui tsc`
  - 结果：通过。
- `pnpm -C packages/nextclaw-ui exec eslint <本次触达文件列表>`
  - 结果：通过，0 error / 0 warning。
- `pnpm --filter @nextclaw/ui exec eslint <本次返回历史修复触达文件列表>`
  - 结果：通过，0 error / 0 warning。
- `pnpm -C packages/nextclaw-ui build`
  - 结果：通过；Vite 仍提示既有 chunk size warning。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本次触达文件列表>`
  - 结果：0 error，2 warning。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本次返回历史修复触达文件列表>`
  - 结果：0 error，1 warning；`doc-browser.manager.ts` 当前 458 行，接近 500 行预算。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <本次返回历史修复触达文件列表>`
  - 结果：1 error，1 warning；因当前工作区同时包含本批 SideDock/pinning 未提交功能增量，HEAD diff 口径下非测试代码净增为 +147，不能单独归因到本次返回历史 bugfix。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过。

补充说明：

- `pnpm -C packages/nextclaw-ui lint` 仍被无关既有 lint debt 阻塞，失败集中在 chat、marketplace、system-status、provider config 等非本次触达文件；本次触达文件已通过 targeted ESLint。
- 尝试启动 `pnpm -C packages/nextclaw-ui exec vite --host 127.0.0.1 --port 5176` 并用浏览器访问，但本地 UI 被 Admin Sign In / 401 拦截，未完成真实点击冒烟；本次用组件测试覆盖 pin / unpin / 内置禁用交互。

## 发布/部署方式

本次尚未发布、未部署、未提交。当前只是本地实现和验证。

## 用户/产品视角的验收步骤

1. 打开 NextClaw UI，确保右侧 SideDock 可见。
2. 点击 SideDock 内置 Docs / Apps / Service Apps / New Tab，确认打开对应右侧栏资源。
3. 在 DocBrowser 顶部点击固定按钮，确认当前非内置资源出现在 SideDock。
4. 固定 Panel App 时确认 SideDock 显示该应用自己的图片 / 文本图标，而不是通用应用图标。
5. 再次点击当前资源的取消固定按钮，确认用户 pin 项从 SideDock 消失。
6. 对内置资源确认固定按钮为已固定不可取消状态。
7. 刷新页面后确认用户 pin 项仍保留。
8. 打开某个 Panel App，再打开 New Tab 或其它右侧栏资源，点击 DocBrowser 返回按钮，确认回到原 Panel App 页面，且不会出现 `PANEL_APP_INVALID_ID` / `/api/panel-apps/api/content`。

## 可维护性总结汇总

本次是新增用户可见能力，非测试代码净增为预期增长。实现保持 SideDock manager 作为 pin/open/unpin owner，DocBrowser 只接收 `dockControls` 能力注入，right-panel-resource resolver 负责资源身份解析，避免 feature-level presenter、manager singleton 或组件内部路由复制。

可维护性检查结果：

- 代码增减报告：新增 598 行，删除 147 行，净增 451 行。
- 非测试代码增减报告：新增 379 行，删除 93 行，净增 286 行。
- maintainability guard：0 error；DocBrowser 与 DocBrowserManager 接近文件预算，后续拆分缝为继续拆出更小的 DocBrowser 子模块 / manager 辅助逻辑。
- 本次顺手减债：将 SideDock `labelKey` 模型收敛为最终字符串，移除业务层对 i18n key 的感知；同时把 DocBrowser pin action 从主组件内抽成轻量 hook，避免主函数继续越过预算。
- 返回历史修复的正向维护动作：职责收敛。稳定资源身份保存到 DocBrowser active history，Panel App content URL 识别收敛到 right-panel-resource route resolver；没有放宽后端校验，也没有让 SideDock 反查 panel app 业务数据。

## NPM 包发布记录

不涉及 NPM 包发布。
