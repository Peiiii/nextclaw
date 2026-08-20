# v0.39.3 重载工具调用会话分级加载

## 迭代完成说明

本迭代解决包含大量、大参数工具调用的历史会话首次进入耗时过长的问题，并保留可重复使用的本地压力会话与生成脚本。

根因由真实压力会话逐段确认：历史分页会重放约 44 MB journal、在读路径重新计算并写入 projection；服务端随后向首屏发送约 13 MB 工具参数与结果；前端即使卡片未展开，也会适配约 1450 个工具 part 并格式化大对象；会话列表与 `getSession` 的无界 sidecar 读取又会争用文件 I/O。只有减少渲染节点不能解决读取、传输和序列化的主耗时，因此本次修复覆盖完整主链路，而不是只遮蔽 loading 症状。

完成内容：

- 历史分页与 `getSession` 改为读取 projection、summary index 和 metadata，不在读取链路重放 journal 或写 projection；
- 仅对已完成且超过预算的历史 assistant 工具载荷返回聚合摘要，并提供稳定消息详情游标；
- 用户展开处理过程时按整条消息读取完整详情，前端负责请求去重、缓存、切换会话时中止和失败重试；
- 大工具组每批渲染 40 项，工具输入与输出只在对应卡片展开时格式化；
- 会话列表先应用 `limit`，sidecar metadata 读取并发限制为 2；
- 保留 `stress-tool-call-heavy-local` 本地压力数据、生成脚本和开发态压力页面；
- 为开发生命周期增加强制设计门，并明确轻量设计与稳定设计文档的适用边界。
- 提前完成结果型营销博客草稿，并通过 changeset 指针与持久草稿状态绑定下一次 stable 产品发布；
- `release:summary` 自动聚合绑定博客，stable 产品闭环在 `NPM_READY` 后阻断未完成的中英文文章、index 或 sidebar，避免 release notes 静默遗漏博客且不前置阻塞 NPM。
- 针对真实 VPS 上约 68 MB、工具调用分散在大量消息中的会话，补充单消息/整页工具调用数量预算；`final` 与 `error` 终态都可按整条消息延迟加载，`pending` / `streaming` 保持完整实时表示；
- 首次进入只对显式 compact 请求按 24 KiB 预算返回最近至少 5 条，随后复用 stream-gap reconcile 自动补齐近期 20 条；相同 snapshot 不再重复 hydrate，更早历史继续沿原滚动分页加载；
- 生产 HTML 在解析阶段抢跑同一 canonical compact API、提前发现 module entry，Chat 主工作区进入首包；VPS Nginx 仅对内容哈希 `/assets/` 静态直出，HTML、API、WebSocket 与运行时注入仍由 NextClaw owner 处理；
- history hook 按职责拆分为交互状态 owner 与 seed/prefetch owner；拒绝会使首屏 gzip 总量从约 420 KiB 增至约 646 KiB 的强制 manual chunk 方案。
- `nextclaw` 发布构建现在为符合条件的 UI 文本资产生成确定性 `.gz` sidecar，prepack、registry tarball 和真实安装验证共用同一逐文件完整性检查；外部 `gzip_static` 部署升级后不再依赖手工重新压缩。

## 测试/验证/验收方式

- kernel、server、UI、agent chat UI 定向测试共 85 项通过；
- 相关 package TypeScript 检查、目标 ESLint、`git diff --check` 与 skill 渐进加载检查通过；
- diff-only 可维护性检查为 0 error；
- 真实冷启动浏览器验证中，最新消息从约 6.94 秒下降到 1.13–1.73 秒；历史请求约 219–281 ms；
- 首屏历史响应由约 13 MB 降至约 262 KB，约 1450 个初始工具 part 降为 20 个聚合摘要；
- 单条约 4.39 MB 详情约 433 ms 加载完成，折叠再展开没有重复请求。
- release summary 9 项博客绑定测试和 stable release 18 项回归测试通过；真实严格检查能够发现当前草稿并按预期返回非零状态，ready 双语夹具可以通过。
- 真实 VPS compact 首批返回 6 条，JSON 15,741 字节、gzip 5,739 字节，Server 读取约 109 ms；普通 20 条后台补齐为 JSON 85,097 字节、gzip 25,969 字节；
- 已登录热刷新 5 次为 0.565–1.384 秒，中位 1.130 秒；首批出现后自动补齐近期 20 条，展开仍能读取完整工具参数与结果；
- 完全绕过缓存的公网样本仍为 10.14–13.86 秒，中位 12.57 秒，主 entry 下载占 9.61–13.27 秒；该剩余瓶颈属于 IP HTTP/1.1 静态传输，不纳入“热刷新 1.13 秒”的结论；
- 后续定向 server 14 项、UI conversation 17 项、NCP React 4 项与应用 4 项测试通过；受影响 TypeScript、目标 ESLint、planned-path preflight、`git diff --check` 通过，diff-only 可维护性检查保持 0 error。
- 真实 7.8 MB UI 产物识别 115 个不少于 1 KiB 的可压缩文件，原始 7,506,103 字节生成 2,176,872 字节 sidecar；重复生成结果一致，缺失、损坏、陈旧和孤立 sidecar 测试均能明确失败。
- VPS `/assets/` 已删除局部 `gzip off` 并通过 `nginx -t` 后无中断 reload：已有 sidecar 的主 entry 继续由 `gzip_static` 返回 419,171 字节 gzip；无 sidecar 的 8 KB 隔离 JavaScript 探针也返回动态 gzip 与 `Vary: Accept-Encoding`。探针已删除，Nginx、NextClaw 和 health 均正常。

## 发布/部署方式

原迭代源码已本地提交；本轮在用户授权的真实 VPS 上完成 server/UI 热修和 Nginx 静态资源直出验收，本次源码跟进把预压缩资产纳入正式 `nextclaw` 发布包，不执行 push、NPM 发布、runtime 发布或桌面发布。VPS 热修仍会被正式安装替换，但新包会自带匹配新 hash 的 sidecar；NPM 可以先达到 `NPM_READY`，博客必须在后续 runtime/docs 产品闭环前转为 `ready`。

## 用户/产品视角的验收步骤

1. 启动或刷新本地开发环境。
2. 打开 `http://127.0.0.1:5174/chat/sid_c3RyZXNzLXRvb2wtY2FsbC1oZWF2eS1sb2NhbA` 对应的重载压力会话。
3. 确认最新消息先快速出现，重载历史消息显示真实工具调用总数和代表性工具名。
4. 展开处理过程，确认完整参数与结果可见，先展示 40 项并可继续加载下一批。
5. 折叠后重新展开，确认详情立即复用且不会重复请求。
6. 运行 `pnpm release:summary -- --json`，确认 changeset 能发现绑定博客；严格模式在草稿未转成正式中英文文章时应明确阻断。
7. 在真实 VPS 重载会话中确认：最近消息快速可读、近期 20 条自动补齐、向上滚动可继续读取更早历史，展开摘要消息仍显示完整工具参数与结果。

## 可维护性总结汇总

本次把事实 owner 收敛为 projection 负责稳定游标、server 负责 UI 载荷预算、前端 history hook 负责详情状态与缓存；没有引入逐工具请求或平行 journal 事实源。compact 只是同一 history API 的显式表示合同，HTML prefetch 只消费一次且失败回到 canonical SDK 路径。history hook 进一步拆为 252 行交互状态 owner 与 134 行 seed/prefetch owner；没有为了指标增加 wrapper。发布资产由单一 `UiDistPrecompressionManager` 负责生成和验证，copy、prepack、tarball 与安装检查复用同一候选规则，不把逻辑复制到 Nginx 或 postinstall。博客发布继续复用 changeset、草稿 frontmatter 和既有 `release:summary`，没有新增平行 manifest 或发布阶段。新增文件均通过 planned-path preflight，未新增 barrel。自动检查最初发现函数复杂度与文件行数问题，拆出工具载荷 hook、summary read store 和局部纯函数后清零 error；release 脚本 scoped maintainability 检查也通过，三个现有热点文件保持在既定预算边界，没有扩大预算。

## 红区触达与减债记录

### packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message.tsx

- 本次是否减债：是
- 说明：把工具详情状态与请求逻辑移入独立 hook，文件保持在 500 行预算内。
- 下一步拆分缝：如消息展示分支继续增长，可按稳定消息类型拆 presenter，但本次不增加无证据抽象。

### packages/nextclaw-kernel/src/stores/ncp-agent-session-journal.store.ts

- 本次是否减债：是
- 说明：摘要读取协调职责移入 summary read store，journal store 保留 canonical journal owner，文件保持在 400 行预算内。
- 下一步拆分缝：仅在 journal 写入协议继续增长时拆写入策略。

### packages/nextclaw-kernel/src/stores/ncp-agent-session-message-projection.store.ts

- 本次是否减债：是
- 说明：projection 继续作为稳定消息游标 owner，没有把游标复制到服务层，文件保持在 400 行预算内。
- 下一步拆分缝：无当前必要拆分。

## NPM 包发布记录

原 changeset 覆盖 `@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/agent-chat-ui`、`@nextclaw/ui` 和 `nextclaw`。本轮性能跟进新增 changeset，覆盖 `@nextclaw/server`、`@nextclaw/ncp-react`、`@nextclaw/ui` 和 `nextclaw`；本轮不发布，状态为待统一发布。
