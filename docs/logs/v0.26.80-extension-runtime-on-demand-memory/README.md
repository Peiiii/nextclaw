# 扩展运行时按需激活与内存收敛

## 迭代完成说明

本次把十个渠道扩展从“宿主启动时全部常驻”改为由 kernel 统一按需管理：只有渠道启用、鉴权会话、短时请求或授权成功交接仍有有效租约时才运行独立扩展进程；最后一个租约释放后进入 30 秒宽限退出。运行时新增 ready、generation、per-extension token、有限重启和进程内存诊断，配置热更新按 enabled 差量协调，不需要重启宿主。

根因是旧启动链在 manifest 被发现后直接批量 `startAll`，把“可安装能力”错误等同为“当前活跃能力”；每个渠道又静态加载完整平台 SDK，即使没有配置微信或飞书也会常驻十个 Node 进程。代码调查、0.29.0 Linux 容器进程树和约 865～885 MiB 空载 working set 共同确认了这一点。修复收回生命周期 owner，而不是仅压低 V8 heap 或隐藏指标，因此直接消除了未启用渠道进程。

详细设计、状态机、验收门槛和逐项证据见 `docs/designs/2026-08-09-on-demand-extension-runtime-lifecycle.design.md`。

## 测试/验证/验收方式

- shared、extension SDK、kernel、server、service 和十个渠道扩展共 15 个 package 的 TypeScript 检查通过。
- 本任务定向自动化共 108 项通过：extension SDK 20、kernel 15、server 15、service 4、微信 31、飞书 14、QQ 9。
- 十个渠道生产 build 通过；本任务 47 个源码文件 ESLint 为 0 warning；governance、maintainability guard 和 `git diff --check` 通过。
- ARM64 Linux 在 2 vCPU / 2 GiB 限制下完成三轮：空配置 0 扩展进程，平均 working set 164.94 MiB；单微信 192.95 MiB；单 Discord 244.47 MiB。相对 0.29.0 空载下降约 80.9%～81.4%。
- AMD64 生产镜像构建通过，并在 `linux/amd64` 模式验证 x86_64、Node x64、健康接口、runtime 状态接口和十渠道清单；QEMU 内存未冒充真实 VPS 指标。
- 真实微信和飞书均完成扫码授权、配置落盘、入站消息、Agent/模型执行与出站回复；飞书真实消息约 7.4 秒完成。配置热启停、generation 旋转、陈旧连接拒绝、并发单 spawn、预期退出和异常重启均有定向或隔离环境证据。
- 相邻完整回归的本任务链路未发现新增失败。既有非本任务问题仍保留：kernel 全量 303/304，剩余 panel-app VM sandbox 缺少 `URLSearchParams`；service 的 175 项 assertion 通过，但进程仍受既有 cron `afterAll` 超时和空响应 JSON parse 未处理影响而非零退出。
- 唯一未闭环的发布级证据是真实 2 vCPU / 2 GiB AMD64 VPS 上的三场景三轮绝对内存矩阵；取得 SSH 目标后按设计文档原口径复测。

## 发布/部署方式

本批只提交源码、测试、changeset、设计与迭代证据，不发布、不部署，也未重启用户现有 NextClaw。后续发布时由 changeset 统一驱动受影响 package 的 patch 发布；发布前应先补齐真实 AMD64 VPS 内存矩阵，再执行适用的 NPM/runtime/desktop 发布合同。

## 用户/产品视角的验收步骤

1. 使用空渠道配置启动，确认 `/api/runtime/extensions` 返回空数组且没有渠道扩展子进程。
2. 在运行中启用一个渠道，确认只启动对应扩展；禁用后租约立即消失并在约 30 秒后退出，宿主不中断。
3. 对禁用的微信或飞书发起扫码，连续轮询确认 PID/generation 不变；扫码成功后确认配置启用且同一进程由持续租约接管。
4. 分别从微信、飞书发送消息，确认原有入站、会话、模型和平台回复链路可用。
5. 人为终止一个仍启用的扩展，确认 generation 旋转并按 1 秒、5 秒、30 秒有限退避恢复；旧 generation 不能继续收发事件。
6. 在真实 AMD64 VPS 按空配置、单微信、单 Discord 各运行三轮，记录 working set、peak 和 PSS，并与设计门槛比较。

## 可维护性总结汇总

本次尽力遵循单一 owner 和清晰边界：kernel lifecycle service 是进程状态唯一 owner，auth lease service 管鉴权与交接计时，SDK 只负责连接和 lazy adapter，server 只做 credential/generation 校验，渠道包只把平台依赖延迟到真正启用时加载。没有增加第二套 supervisor、配置 owner 或 legacy 旁路。

自动 maintainability guard 无 blocker；8 项提醒均为接近文件预算，核心 lifecycle/runtime 文件仍低于 600 行。随后完成主观复核，状态迁移、timer 清理、租约语义和 payload 解析已拆到单一职责 helper/service，未发现为压行数制造的空壳抽象。hotspot 清单中的现有红区文件均未触达；目录和新文件角色通过 planned-path preflight 与 governance 检查。

## NPM 包发布记录

本次提交不执行 NPM 发布。以下工作区变更均为未发布状态，changeset 已标记 patch，待后续统一发布：

- `nextclaw`
- `@nextclaw/kernel`
- `@nextclaw/server`
- `@nextclaw/service`
- `@nextclaw/shared`
- `@nextclaw/extension-sdk`
- `@nextclaw/channel-extension-dingtalk`
- `@nextclaw/channel-extension-discord`
- `@nextclaw/channel-extension-email`
- `@nextclaw/channel-extension-feishu`
- `@nextclaw/channel-extension-qq`
- `@nextclaw/channel-extension-slack`
- `@nextclaw/channel-extension-telegram`
- `@nextclaw/channel-extension-wecom`
- `@nextclaw/channel-extension-weixin`
- `@nextclaw/channel-extension-whatsapp`

发布触发条件：真实 AMD64 VPS 内存复测闭环，并由后续明确的发布指令启动对应发布合同。
