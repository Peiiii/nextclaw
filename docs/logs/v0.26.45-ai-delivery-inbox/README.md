# AI 主动送达与收件箱

## 迭代完成说明

- 新增持久化的 AI 主动送达能力。Agent 可调用 `deliver_to_inbox`，直接传 Markdown 正文，或传绝对文件路径并在执行时保存 UTF-8 文本快照。
- Kernel `InboxDeliveryManager` 统一拥有创建、查询、呈现、已读、未读、归档、恢复、删除和继续聊状态；`InboxDeliveryStore` 使用版本化 JSON 与临时文件 rename 原子写入。
- `presentedAt` 与 `readAt` 分离：自动阅读层关闭后内容仍未读，但不会再次自动弹；重新标记未读也不会清除已呈现事实。
- 新增 `/api/inbox/deliveries` HTTP 合同、Client SDK `inboxDeliveries` namespace 与轻量 `inbox.delivery.changed` 实时事件。实时事件只携带 ID 和操作类型，正文以 HTTP 权威数据为准。
- 新增全局阅读弹窗，同一时间只显示一个弹窗；多条未读内容在同一窗口中切换。正文复用安全 Markdown renderer，不执行任意 HTML。
- 新增桌面双栏、移动列表/详情式收件箱，包含未读/全部/已归档筛选、已读切换、归档、恢复、删除和继续聊；桌面侧栏与移动底栏显示未读提示。
- “继续聊”创建或复用真实 NCP 会话，并通过 `inbox_delivery_id` 会话元数据和 Context Provider 在后续 Agent 运行时注入送达内容，不把报告伪装成用户消息。
- 阅读弹窗初始焦点落在标题，不会误触发上一项/下一项 tooltip；视觉使用轻边框、受控阴影和 24px 圆角，避免此前讨论过的过大阴影与松散边距。
- 正式方案见 `docs/designs/2026-08-06-ai-delivery-inbox.design.md`。

## 测试/验证/验收方式

- 定向测试：
  - Kernel：2 个测试文件、8 项通过，覆盖并发持久化、状态不变量、关联会话、上下文注入、直接正文、文件快照、参数互斥与非法 UTF-8。
  - Server：1 个测试文件、2 项通过，覆盖列表、状态更新、继续聊与非法 action。
  - Client SDK：`nextclaw-client.test.ts` 共 16 项通过，包含 inbox 路径编码与 GET/PATCH/POST 请求合同。
  - UI：2 个测试文件、3 项通过，覆盖自动呈现、关闭不已读、单一阅读层、安全 Markdown 展示与标题焦点。
- TypeScript：`@nextclaw/shared`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/ui` 全部通过。
- ESLint：上述五个包全部通过；本轮新增代码 0 error、0 warning。
- 生产构建：上述五个包全部通过。Server 仅有第三方依赖既有的 `eval` / Axios 类型导出提示；UI 仅有既有 Browserslist 数据与大 chunk 提示。
- 隔离 Kernel/API 冒烟：在临时 home 中完成创建、GET 列表、PATCH 呈现、POST 继续聊、真实 session 创建和 Kernel 重建后持久化恢复；结果为 HTTP 200、单项恢复、呈现后仍未读、继续聊后已读。
- 真实页面与视觉验收：隔离端口启动真实 Server + Vite 页面；1280×800 下同一阅读窗依次展示两项，关闭两项后 reload 不再弹但收件箱仍显示“2 项未读”；桌面双栏和 390×844 移动列表布局通过；初始焦点为标题且 tooltip 数量为 0。
- 隔离页面验收没有启动完整 Agent runtime，因此浏览器同时记录到其他应用接口和资源的预期 404/503；这些请求未经过 Inbox API，收件箱创建、读取、状态更新、继续聊与页面交互均按独立链路验收通过。
- 治理：`pnpm lint:new-code:governance` 与 `pnpm check:governance-backlog-ratchet` 通过。
- 可维护性守卫：本功能相关新增目录均有合法 role 与 owner；全工作区守卫仍被并行用户改动 `packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts` 的既有超长文件继续增长阻断，本轮未触碰或覆盖该改动。
- 生成物：构建后 `pnpm check:generated-clean` 通过。

## 发布/部署方式

- 本轮未提交、未推送、未部署，也未发布 NPM 包。
- 已添加 Shared、Kernel、Server、Client SDK 与 UI 的 patch changeset，等待后续统一发布。
- 不涉及数据库 migration、线上服务部署、runtime update channel 或桌面安装包发布。

## 用户/产品视角的验收步骤

1. 让 AI 完成一份报告，并调用 `deliver_to_inbox` 传入 Markdown `content` 或绝对 `filePath`。
2. 保持界面打开，确认只出现一个阅读弹窗；若有多项，使用上一项/下一项在同一窗口切换。
3. 点击右上角关闭或“稍后阅读”，确认内容仍在收件箱显示未读；刷新或再次进入后，同一项不会重复自动弹出。
4. 打开收件箱，检查未读、全部、已归档筛选及 Markdown 正文；验证标记未读、归档、恢复和删除。
5. 点击“继续聊”，确认进入新的关联会话；发送后续问题，确认 AI 能理解送达报告内容。
6. 在移动端重复打开列表和详情，确认底部导航未读提示、返回动作和操作区可用。

## 可维护性总结汇总

- 可维护性复核结论：本功能通过；全工作区自动守卫存在一项与本轮无关的并行改动红项，已独立披露。
- 代码增减：生产源码 `+1741/-18`，测试源码 `+539/-0`，合计源码 `+2280/-18`；另新增中文设计文档、changeset、provider 目录预算说明与本迭代记录。
- 这是跨 Shared、Kernel、Server、SDK、UI 的新增用户能力，生产代码净增符合新增能力豁免。增长集中在明确 owner 和端到端合同，没有新增兼容路径或复制旧实现。
- 正向减债：把收件箱页面拆成页级编排、列表面板与阅读面板；React Query 继续作为服务端事实 owner，Zustand 仅保存弹窗 UI 状态；工具、API、事件和界面共用唯一 Kernel mutation owner。
- 目录预算：Tool Provider、Context Provider 和 Client SDK services 都是稳定扩展点的同角色扁平目录，已有或新增明确预算说明；没有为了通过预算制造单文件假子树。
- 收件箱实现本身没有新增可维护性问题。

## NPM 包发布记录

- `@nextclaw/shared`：需要 patch，新增 Inbox Delivery 公共合同、会话元数据 key 与实时事件类型；当前 `0.4.16`，状态为 `待统一发布`。
- `@nextclaw/kernel`：需要 patch，新增持久化 owner、Agent 工具、Tool Provider 与 Context Provider；当前 `0.6.19`，状态为 `待统一发布`。
- `@nextclaw/server`：需要 patch，新增 Inbox Delivery HTTP API；当前 `0.15.19`，状态为 `待统一发布`。
- `@nextclaw/client-sdk`：需要 patch，新增 `inboxDeliveries` namespace；当前 `0.5.19`，状态为 `待统一发布`。
- `@nextclaw/ui`：需要 patch，新增全局阅读层、收件箱页面、导航入口、未读提示与中英文文案；当前 `0.15.20`，状态为 `待统一发布`。
