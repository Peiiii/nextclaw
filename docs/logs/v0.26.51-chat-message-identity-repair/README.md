# 2026-08-07 v0.26.51-chat-message-identity-repair

## 迭代完成说明

- 修复聊天历史中消息相互覆盖、React 重复 key 警告以及字面量 `\n\n` 静默回复可见的问题。
- 根因一：消息投影只把 `lastMessageId` 当作可更新记录；较早的 assistant 消息在后续并发 run 之后才完成时，同一 ID 会被追加成第二个序号，破坏“消息 ID 唯一”合同。
- 根因二：NCP 水合入口原样接收服务端历史数组，没有在外部数据边界恢复 ID 唯一性；重复 ID 因而继续进入 React 虚拟列表。
- 根因三：静默回复 prompt 把正确示例写成字面量 `"\\n\\n<noreply/>"`，MiniMax 按字面输出；Markdown 隐藏 `<noreply/>` 标签后只剩可见的 `\n\n`。
- 通过真实接口中重复的 `assistant-message-2205c80f-c48d-4acf-a3e9-12e147a4458c`、浏览器控制台重复 key 警告、重复 `data-index="6"` 和无 transform 的绝对定位行确认了完整根因链，而不是从局部 CSS 推测。
- 修复将投影更新改为全局 `messageId -> ordinal`，投影版本升级为 v2 以自动重建旧派生数据；NCP 水合保留同一 ID 的最新快照；静默标记识别迁到 browser-safe shared 合同，core 与 UI 复用唯一实现；prompt 改为只输出 `<noreply/>`。

## 测试/验证/验收方式

- 修前失败基线：投影乱序完成、投影不稳定 tail、NCP 重复水合、隐藏/静默消息可见、错误静默 prompt 共 5 类定向断言稳定失败。
- 修后定向测试：kernel 17/17、NCP toolkit 2/2、UI 20/20、shared 2/2 通过。
- 受影响整包测试：shared 27/27、core 194/194、NCP toolkit 40/40 通过。kernel 与 UI 整包仍有脏工作区内的既有失败，分别位于 messaging tool/context provider/activity preview，以及 workspace/mobile/QueryClient 测试，不属于本次触达链路。
- TypeScript：`@nextclaw/shared`、`@nextclaw/core`、`@nextclaw/ncp-toolkit`、`@nextclaw/kernel` 通过；`@nextclaw/ui` 被 conversation 区域两个既有类型错误阻塞，本次 UI 触达文件的定向 ESLint、Vitest、Vite production build 和 5174 consumer 均通过。
- ESLint：五个受影响包均为 0 error；全部触达文件定向 ESLint 通过。
- 治理：`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`git diff --check`、生成物清洁检查通过。
- 真实页面 `http://127.0.0.1:5174/chat/sid_Y3Jvbjo0ZDFjYTRiYg`：reload、普通滚动、大跨度滚动、滚到底部、Processed 展开/收起均为重复 index 0、几何重叠 0、缺少 transform 行 0，且不可见 `\n\n` / `<noreply/>`。
- 真实接口终态：`total=14`、加载 14、唯一 ID 14、重复 ID 0、`hasPreviousPage=false`。

## 发布/部署方式

- 本次未提交、未推送、未发布、未部署，也未主动重启任何 NextClaw 实例。
- `pnpm build:ui` production build 通过；验证后已运行 `pnpm clean:generated`，未保留 `packages/nextclaw/ui-dist` hash 产物。
- 5174 开发实例已消费最新源码。55667 由全局安装的 `nextclaw` 提供旧静态前端；当前源代码交付不擅自覆盖全局安装或重启该服务。

## 用户/产品视角的验收步骤

1. 打开用户报告的 5174 会话 URL 并强制刷新。
2. 从顶部滚动到中部、底部，再展开和收起任一“已处理”区域。
3. 确认消息纵向连续排列，没有任何两条卡片覆盖，也没有孤立的 `\n\n` 行。
4. 打开控制台，确认没有 `Encountered two children with the same key`。
5. 在下一次正常构建/安装并重载 55667 服务后，对同一会话 URL 重复以上步骤。

## 可维护性总结汇总

- 已使用 post-edit maintainability guard/review。最终 scoped 报告为总计 `+249 / -28 / net +221`，非测试代码 `+69 / -28 / net +41`；总数包含触达文件中任务开始前已存在的测试与 prompt 改动。
- line-growth exemption：保留非测试净增 41 行。必要增长主要是可缓存的全局消息序号索引和 browser-safe 静默合同；它们分别替代了错误的“只认最后一条”状态假设和 core/UI 无法共享的私有判定。
- 已检查并拒绝的更短方案：随机/复合 React key 只掩盖重复数据；CSS/virtualizer 特判只掩盖错误 DOM 身份；每次投影边界全量重放 journal 会退化为 O(n²)；继续压缩索引代码会隐藏 IO、缓存与 ordinal 语义。
- 本次顺手删除了刚形成的 kernel metadata 归一化双路径，让 shared 静默合同成为唯一判断 owner；NCP 状态管理器保持 600 行不增长；没有新增 effect、wrapper、factory、alias 或平行持久化事实源。
- 投影 store 当前 358/400 行，后续观察缝是把固定宽度 index 读取与 ID ordinal 索引下沉到现有 projection utils owner；只有继续增长或出现第二个消费者时再拆，避免为过线制造空心抽象。
- 可维护性复核结论：保留必要增长，经本迭代记录显式接受；正向动作是删除双路径、收敛共享合同和强化投影 owner 的唯一性不变量，不是机械压行。

## NPM 包发布记录

- 本次未执行 NPM 包发布。
- 已新增 `.changeset/chat-message-identity-repair.md`，登记 `@nextclaw/shared`、`@nextclaw/core`、`@nextclaw/ncp-toolkit`、`@nextclaw/kernel`、`@nextclaw/ui` 与产品包 `nextclaw` 的 patch 变更。
- 当前状态：待统一发布；本轮不涉及 migration，未部署线上环境。
