# 会话活动预览国际化

## 迭代完成说明

本次补齐会话列表活动预览的国际化。根因是 kernel 把 `Thinking`、`Calling tool`、`Tool call completed` 和 `Run failed` 直接拼成英文 `statusText` 写入持久化 metadata，UI 再原样展示；因此中文界面无法翻译这些状态。用户截图、真实 session API 和修前失败测试共同确认了这条链路。

修复后，kernel 只写稳定 `statusKind` 与必要的工具名/错误详情，前端 i18n owner 负责最终文案；会话错误横幅复用同一个预览格式化入口。旧会话中的英文 metadata 只在前端展示边界按已发布的固定格式读取，不修改持久化数据，不形成第二条写入链路。

## 测试/验证/验收方式

- `@nextclaw/kernel` activity preview 定向测试：10/10 通过。
- `@nextclaw/ui` adapter、display 与 conversation assembled tests：33/33 通过。
- `pnpm --filter @nextclaw/kernel tsc`、`pnpm --filter @nextclaw/server tsc`、`pnpm --filter @nextclaw/ui tsc` 通过。
- kernel、server、UI package ESLint 均为 0 error；kernel/server 只有未由本次引入的历史 warning。
- staged patch 隔离运行 `lint:new-code:governance` 通过，`pnpm check:governance-backlog-ratchet` 通过；全工作区治理检查被并行 WIP 中 `provider-registry.provider.ts` 的跨目录相对导入阻塞，与本迭代文件无关。
- server 路由定向测试被工作区另一处未完成的 `@stdio-runtime-client/stdio-runtime-config.utils.js` alias 改动阻塞；server `tsc` 通过，controller 行为由定向断言保留，剩余缺口是待该无关 alias 修复后重跑路由测试。

## 发布/部署方式

本次只完成源码、测试、changeset 与迭代记录，没有执行部署、NPM 发布、提交或推送。后续进入统一发布批次时随对应 package patch 发布。

## 用户/产品视角的验收步骤

1. 以中文打开 `http://127.0.0.1:5174/chat`。
2. 查看正在思考、调用工具、工具完成、运行失败或意外中断的会话列表第二行。
3. 确认状态文案为中文，工具名与原始错误详情保持不变。
4. 切换英文后确认同一状态显示英文；已有旧会话不再直接暴露 `Tool call completed` 等英文固定前缀。

本地真实 UI 验收结果：英文 `Tool call completed` 可见数量为 0，中文工具活动可见，历史中断预览显示“运行意外中断，请重新发送消息。”。

## 可维护性总结汇总

已运行 `post-edit-maintainability-guard --non-feature --no-fail` 与 `post-edit-maintainability-review`。守卫检查 14 个源码/测试文件：总计新增 154 行、删除 60 行、净增 94 行；非测试新增 109 行、删除 47 行、净增 62 行。

本次申请并记录 line-growth exemption：增长用于把英文展示字符串改成稳定状态合同、在唯一 UI 展示 owner 中完成本地化，并覆盖真实存在的持久化旧数据。已删除后端英文拼接 helper、服务端英文中断常量与会话错误横幅的重复格式化路径；未新增组件、service、manager、文件或平行写入链路。继续压缩只能退回“前端猜英文字符串”、削弱状态类型，或放弃旧数据即时本地化，会降低可预测性与类型安全。

兼容路径的主合同是已发布并持久化的 `last_activity_preview.statusText`。触发范围仅限缺少 `statusKind` 且匹配五种历史固定前缀的旧记录，owner 是前端活动预览格式化边界；它是纯读取、无副作用。删除条件是完成 session metadata backfill，或产品明确不再保留这些旧 session 记录。

文件组织未新增源码文件或目录；现有 contribution `types/`、`utils/`，server controller 与 UI feature utils 角色保持不变。守卫只提示 `session-conversation-area.tsx` 接近文件预算、`ncp-session-adapter.utils.ts` 接近 400 行以及 `shared/lib/api` 的既有目录豁免，本次未新增对应文件数量或抽象层。

## NPM 包发布记录

需要进入后续统一 NPM 发布批次，当前均未发布：

- `@nextclaw/kernel`：patch，活动预览改为稳定状态合同。
- `@nextclaw/server`：patch，意外中断不再生成英文用户文案。
- `@nextclaw/ui`：patch，活动预览按界面语言格式化并兼容已持久化旧数据。
