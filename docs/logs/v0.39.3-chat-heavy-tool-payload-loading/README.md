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

## 测试/验证/验收方式

- kernel、server、UI、agent chat UI 定向测试共 85 项通过；
- 相关 package TypeScript 检查、目标 ESLint、`git diff --check` 与 skill 渐进加载检查通过；
- diff-only 可维护性检查为 0 error；
- 真实冷启动浏览器验证中，最新消息从约 6.94 秒下降到 1.13–1.73 秒；历史请求约 219–281 ms；
- 首屏历史响应由约 13 MB 降至约 262 KB，约 1450 个初始工具 part 降为 20 个聚合摘要；
- 单条约 4.39 MB 详情约 433 ms 加载完成，折叠再展开没有重复请求。
- release summary 9 项博客绑定测试和 stable release 18 项回归测试通过；真实严格检查能够发现当前草稿并按预期返回非零状态，ready 双语夹具可以通过。

## 发布/部署方式

本次只完成本地源码提交，不执行 push、NPM 发布、runtime 发布、桌面发布或部署。后续随统一版本发布流程交付；NPM 可以先达到 `NPM_READY`，博客必须在后续 runtime/docs 产品闭环前转为 `ready`。

## 用户/产品视角的验收步骤

1. 启动或刷新本地开发环境。
2. 打开 `http://127.0.0.1:5174/chat/sid_c3RyZXNzLXRvb2wtY2FsbC1oZWF2eS1sb2NhbA` 对应的重载压力会话。
3. 确认最新消息先快速出现，重载历史消息显示真实工具调用总数和代表性工具名。
4. 展开处理过程，确认完整参数与结果可见，先展示 40 项并可继续加载下一批。
5. 折叠后重新展开，确认详情立即复用且不会重复请求。
6. 运行 `pnpm release:summary -- --json`，确认 changeset 能发现绑定博客；严格模式在草稿未转成正式中英文文章时应明确阻断。

## 可维护性总结汇总

本次把事实 owner 收敛为 projection 负责稳定游标、server 负责 UI 载荷预算、前端 history hook 负责详情状态与缓存；没有引入逐工具请求或平行 journal 事实源。博客发布继续复用 changeset、草稿 frontmatter 和既有 `release:summary`，没有新增平行 manifest 或发布阶段。新增文件均通过 planned-path preflight，未新增 barrel。自动检查最初发现函数复杂度与文件行数问题，拆出工具载荷 hook、summary read store 和局部纯函数后清零 error；release 脚本 scoped maintainability 检查也通过，三个现有热点文件保持在既定预算边界，没有扩大预算。

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

本次 changeset 覆盖 `@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/agent-chat-ui`、`@nextclaw/ui` 和 `nextclaw`。本轮不发布，状态为待统一发布。
