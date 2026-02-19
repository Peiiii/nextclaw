# 2026-02-19 v0.6.30-noreply-marker-stop-processing

## 迭代完成说明（改了什么）

- 静默标记从 `NO_REPLY` 调整为 `<noreply/>`，并统一定义在：
  - `packages/nextclaw-core/src/agent/tokens.ts`
- 静默判定策略调整为：**只要文本中出现 `<noreply/>`（大小写不敏感）即判定静默**。
- Agent 主循环新增“提前停止”机制：
  - 当模型任一轮返回内容中出现 `<noreply/>`，立即停止本轮后续处理（不再执行后续 tool calls，不下发回复）。
  - 覆盖普通消息与 system 消息两条主链路。
- 同步更新系统提示与模板文档：
  - 指导模型使用“空两行 + `<noreply/>`”作为静默输出格式。
  - 文档说明从“exactly NO_REPLY”更新为“contains `<noreply/>`”。

## 测试 / 验证 / 验收方式

- 工程级验证（规则要求）：
  - `pnpm build`
  - `pnpm lint`
  - `pnpm tsc`
- 冒烟验证（静默标记行为）：
  - 在隔离目录 `/tmp` 执行 `pnpm dlx tsx` 冒烟脚本，直接导入源码策略函数：
  - 运行命令：`cd /tmp && pnpm dlx tsx /tmp/smoke-noreply.ts`
  - 验证点：
    - 普通文本 -> 不静默
    - `\n\n<noreply/>` -> 静默
    - 含业务文本 + `<noreply/>` -> 静默并停止后续处理

## 发布 / 部署方式

- 按项目发布流程执行：
  1) 通过 changeset 生成版本变更
  2) 执行 `pnpm release:version`
  3) 执行 `pnpm release:publish`
- 若本次涉及 `@nextclaw/core` 升版，需遵循联动发布规则：
  - 同步升级并发布直接依赖 `@nextclaw/core` 的包。
