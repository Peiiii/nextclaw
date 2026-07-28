# HTML 展示参数合同

## 迭代完成说明

- 为 `show_panel_app`、`show_file` 和聊天内联展示协议增加可选 `params`，让同一 Panel App 或 HTML 文件按每次展示上下文渲染，而不再要求把临时数据写入文件或查询字符串。
- `params` 的唯一页面合同是同步可用、深冻结的 `window.nextclaw.params`。宿主通过版本化 `window.name` 信封传递值，页面引导脚本读取后立即清空信封；参数值不进入 URL、服务端状态或日志。
- Panel App 始终带参数引导能力；普通 HTML 只有在宿主追加固定能力标记时才注入引导脚本，非 HTML 与源码查看路径不接受参数，避免扩大任意内容注入面。
- 共享校验 owner 统一约束 JSON 对象、有限数值、无循环引用、最多 32 层和 64 KiB UTF-8 序列化体积；独立发布的 agent chat UI 保持相同边界，不新增跨包深层依赖。
- 相同展示目标收到新参数时更新现有标签并重载 iframe；无参数调用保持原行为。完整方案见 `docs/designs/2026-07-28-content-params.design.md`。

## 测试/验证/验收方式

- 共享合同定向测试：10/10 通过，覆盖合法 JSON、非法值、循环、深度、体积、`window.name` 信封与 HTML 能力标记。
- Kernel 定向测试：17/17 通过，覆盖工具 schema/校验、Panel App bridge 和参数引导注入。
- Server controller：23 个通过、2 个既有跳过，覆盖仅对显式标记的 HTML 注入、无标记/非 HTML 保持原响应。
- Agent chat UI 定向测试：6/6 通过；产品 UI 相关 7 个测试文件共 68/68 通过，并对 DocBrowser 状态迁移与 manager 追加回归验证。
- `@nextclaw/shared`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/agent-chat-ui`、`@nextclaw/ui` 的 `tsc`、lint 与构建通过；server lint 只报告未触达文件中的既有 warning。
- 隔离源码实例运行在临时 `NEXTCLAW_HOME` 与独立端口；浏览器同时加载真实 Panel App content route 与带能力标记的 server-path HTML route，两者均在首个作者脚本中读到参数并显示嵌套值深冻结。截图已附到 Linear NC-148。
- 生成物清洁检查、diff whitespace 检查、增量治理、历史债务棘轮与可维护性守卫通过。

## 发布/部署方式

- 本次按 Linear 委派合同只提交并尽量 fast-forward 合入本地 `master`；不 push、不创建 PR，不执行 release、deploy、migration、生产操作，也不重启用户现有 NextClaw 实例。
- 用户可见能力已添加 changeset，等待后续统一发布。

## 用户/产品视角的验收步骤

1. 调用 `show_panel_app` 并传入嵌套 `params`，确认 Panel App 的首个作者脚本即可同步读取 `window.nextclaw.params`。
2. 调用 `show_file` 展示 HTML 并传入数组、对象和标量，确认 rendered preview 正确读取；切到源码查看或展示非 HTML 时确认参数被拒绝。
3. 对同一 Panel App/HTML 标签使用不同参数再次展示，确认复用现有标签并刷新为新值，而不是保留旧上下文。
4. 在页面中尝试修改根参数与嵌套对象，确认对象保持深冻结；检查 iframe URL，确认参数值没有进入查询字符串。
5. 省略 `params` 重复原有 Panel App、HTML、文件源码与 inline card 流程，确认行为不变。

## 可维护性总结汇总

- 本次是新增用户能力，允许必要的生产语义代码增长；参数校验、传输信封和 HTML 引导注入分别归 shared contract、kernel injection 与 UI host owner，没有新增 service、manager 或平行状态源。
- 通过把 DocBrowser 的手工导航和 tab 更新纯状态迁移移入既有 `doc-browser-state.utils.ts`，`doc-browser.manager.ts` 相对基线净减 18 行，降低已知热点而非用压行规避守卫。
- 参数沿既有 tool payload、chat card、workspace tab 与 DocBrowser 主链路传递；没有 query-value 泄漏、服务端存储、兼容双写或第二套 Panel App bridge。
- 主观复核发现并修复了“同 URL 只更新 iframe `name` 不会重新执行 bootstrap”的生命周期缺口；内联 Panel App 与 rendered HTML 现在只在参数信封真实变化时 remount，无参数与相同参数更新保持稳定。
- 最终合计新增 988 行、删除 66 行，净增 922 行；非测试新增 483 行、删除 56 行，净增 427 行。作为新增用户能力不适用非功能改动净增不大于零门槛，增长主要来自跨层合同、严格边界、回归测试、设计和交付记录。
- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review`：0 error，7 个 warning 均为既有例外或接近预算提示；无刻意保留的新债务。

## NPM 包发布记录

- `@nextclaw/shared`：需要 patch，新增跨层参数类型、校验与宿主传输合同，待统一发布。
- `@nextclaw/kernel`：需要 patch，工具合同与 HTML 引导注入，待统一发布。
- `@nextclaw/server`：需要 patch，显式标记 HTML 的安全注入路径，待统一发布。
- `@nextclaw/agent-chat-ui`：需要 patch，聊天内联协议与独立输入校验，待统一发布。
- `@nextclaw/ui`：需要 patch，Panel App、rendered HTML、workspace 与 DocBrowser 参数传递，待统一发布。
- Changeset：`.changeset/content-display-params.md`。
- 本次未执行 NPM 发布。

## 红区触达与减债记录

### packages/nextclaw-ui/src/shared/components/doc-browser/managers/doc-browser.manager.ts

- 本次是否减债：是。
- 说明：移出两段纯状态迁移到既有 state utils，保持 manager 聚焦编排，并让文件相对基线净减 18 行。
