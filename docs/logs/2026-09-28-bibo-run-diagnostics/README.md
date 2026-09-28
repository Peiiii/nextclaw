# Bibo 长会话失败与诊断日志

## 迭代完成说明

状态：发布准备中。用户指定会话最后几次消息失败，并要求具备可从服务端排查的标准化日志，随后要求上线。根因与验收合同见[设计记录](../../designs/2026-09-28-bibo-run-diagnostics.design.md)。

线上容器在 2026-09-28 07:09:21Z、07:10:01Z 返回模型输入过长 HTTP 413；托管模型代理对完整 JSON 使用 128 KiB 限制，早于 NextClaw 默认约 190000 token 的上下文压缩触发。修复移除该语义冲突，保留 16 MiB 异常传输上限，继续由 NextClaw kernel 执行压缩。新增贯通 Worker、DO、Container runner 与模型网关的结构化日志和只读历史查询命令。

## 测试/验证/验收方式

本地 25 项诊断回归和 23 项内核压缩测试通过；Bibo 三范围 TypeScript、客户端/runner 构建、桌面/手机模拟 API 浏览器回归、定向 lint、治理和维护性检查通过。全套 app 测试中的未修改 `bibo-space.store.test.ts` 在 Node 测试环境加载 CSS 时失败，单独运行亦复现；此项不计入通过范围。

上线后须确认 Worker 与 Container 都已更新；用专用测试账号运行真实模型、提交、刷新和恢复冒烟；查询新日志确认同一 runId/sessionId 跨层串联。线上测试只使用专用账号，不改用户指定的真实会话。

## 发布/部署方式

本批涉及 Worker 路由/配置及 Container runner，使用完整 `pnpm -C apps/bibo-hosted run deploy`，从冻结远程 `master` 干净检出运行。没有存储 migration、NextClaw NPM/runtime/desktop 发布，也不部署文档站。发布前记录 Worker/Container 身份，发布后核对新身份、线上真实链路和日志。具体 SHA、版本、结果在执行后补录。

## 用户/产品视角的验收步骤

登录 [Bibo](https://app.bibo.bot/) → 在长会话发送消息 → 等待回答保存 → 刷新后仍可看到该轮；维护者可用会话 ID 或 runId 从服务端查询失败阶段和错误码。长会话行为及线上日志待部署后验证。

## 可维护性总结汇总

上下文预算仍由 kernel 唯一拥有；Bibo 仅限制异常传输体积。诊断字段使用白名单标量，不写正文、凭据或完整异常消息；DO 仍拥有提交结论。HTTP 路由搬到独立文件使原 app 文件从 401 行降到 367 行。planned-path preflight、governance 通过；maintainability 0 error，两个警告为既有目录数量和 app 文件接近预算。人工 Review 无未关闭代码 finding。

## NPM 包发布记录

不涉及 NPM 包发布。`@nextclaw/bibo-hosted` 是私有托管服务；用户可见修复有 patch changeset，交付对象为 Worker 和 Container。
