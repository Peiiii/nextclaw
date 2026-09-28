# Bibo 长会话失败与诊断日志

## 迭代完成说明

状态：已部署 Bibo，实际会话与日志链路通过线上验收；本机日志 CLI 仍缺 Cloudflare Observability 查询权限。用户指定会话最后几次消息失败，并要求具备可从服务端排查的标准化日志，随后要求上线。根因与验收合同见[设计记录](../../designs/2026-09-28-bibo-run-diagnostics.design.md)。

线上容器在 2026-09-28 07:09:21Z、07:10:01Z 返回模型输入过长 HTTP 413；托管模型代理对完整 JSON 使用 128 KiB 限制，早于 NextClaw 默认约 190000 token 的上下文压缩触发。修复移除该语义冲突，保留 16 MiB 异常传输上限，继续由 NextClaw kernel 执行压缩。新增贯通 Worker、DO、Container runner 与模型网关的结构化日志和只读历史查询命令。

## 测试/验证/验收方式

本地 26 项诊断回归和 23 项内核压缩测试通过；Bibo 三范围 TypeScript、客户端/runner 构建、桌面/手机模拟 API 浏览器回归、定向 lint、治理和维护性检查通过。全套 app 测试中的未修改 `bibo-space.store.test.ts` 在 Node 测试环境加载 CSS 时失败，单独运行亦复现；此项不计入通过范围。

线上 Worker 与 Container 均已 100% 更新。专用测试账号的第二轮真实冒烟通过模型流式返回、搜索、Agent 文件生成、快照保存、刷新及桌面/手机文件预览；150117 字节模型请求返回 HTTP 200。Cloudflare API 查询 run `6fb7b4d1-5f42-4b61-89fb-2156700e1394` 时，Worker、Container、模型网关及提交事件带同一 run/session ID；未改用户指定的真实会话。查询 API 标示 `abr_level=1`，可见记录是正证据，不能据此声称无遗漏。

## 发布/部署方式

本批涉及 Worker 路由/配置及 Container runner，从冻结远程 `master` 提交 `37f9e3667d760d19de0391f254ea102212e0f7a3` 的干净工作区执行完整 `pnpm -C apps/bibo-hosted run deploy`。发布前 Worker `03c40026-4164-404a-aec8-bd5568498965`、容器版本 22、镜像 `sha256:b32bcfb2cde302b69944695df41ee5395ee3f27a6d1d6acc36cc1515f55b381a`；发布后 Worker `afff6f75-bfe3-4f2e-a2f8-7270b2eb6a3f` 100%，容器版本 23、镜像 `sha256:4ef68e222cc8ea7f8bdd9681aa1ca78890cda123eda9e8b522ff24b388fe364c` 100%。Docker 依赖下载首轮超时，由 Dockerfile 既有重试完成；镜像与 Worker 部署成功。第一次冒烟启动时容器只滚动到 20%，后续完成滚动再跑的第二轮才计入新镜像验收。没有存储 migration、NextClaw NPM/runtime/desktop 发布，也不部署文档站。

部署后发现本机日志 CLI 对 Cloudflare `abr_level=1` 的短查询直接报错，虽 API 已返回有用记录；改为输出记录并在 JSON 中标记 `complete: false` 与 `samplingLevel`，并把 run/session 过滤下推 API。该改动只影响本地只读查询工具和文档，不需重发 Worker/Container。`AUTOMATION_INTERVENTIONS: 1`：问题为采样结果处理过严，修复归查询命令 owner 并补回归测试。本机 Wrangler OAuth 对 Observability 查询为 403，需有对应权限的 API token；已连接的 Cloudflare API 工具可直接查询，无须浏览器。

## 用户/产品视角的验收步骤

登录 [Bibo](https://app.bibo.bot/) → 在长会话发送消息 → 等待回答保存 → 刷新后仍可看到该轮；维护者可用会话 ID 或 runId 从服务端查询失败阶段和错误码。AI 已验证独立专用账号的真实对话、保存/刷新、150117 字节模型请求和线上日志串联；用户原始会话本身未再次发送消息，不宣称其具体下一轮已经成功。

## 可维护性总结汇总

上下文预算仍由 kernel 唯一拥有；Bibo 仅限制异常传输体积。诊断字段使用白名单标量，不写正文、凭据或完整异常消息；DO 仍拥有提交结论。HTTP 路由搬到独立文件使原 app 文件从 401 行降到 367 行。planned-path preflight、governance 通过；maintainability 0 error，两个警告为既有目录数量和 app 文件接近预算。人工 Review 无未关闭代码 finding。

## NPM 包发布记录

不涉及 NPM 包发布。`@nextclaw/bibo-hosted` 是私有托管服务；用户可见修复有 patch changeset，交付对象为 Worker 和 Container。
