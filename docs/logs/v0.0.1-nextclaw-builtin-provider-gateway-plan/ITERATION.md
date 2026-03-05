# Iteration v0.0.1-nextclaw-builtin-provider-gateway-plan

## 1) 迭代完成说明（改了什么）
- 本迭代为方案定稿迭代，先不改业务代码，沉淀 NextClaw「开箱即用内置 AI Provider」的实施方案与边界。
- 已确认产品目标：
  - 让用户安装后可直接体验，不要求先自行准备第三方 API Key。
  - 当前阶段目标是“快速体验”，不是“长期免费使用”。
- 已确认技术路线：
  - 基于 Cloudflare Worker 实现 NextClaw 网关 API（OpenAI 兼容风格）。
  - 上游首期接入 DashScope，首批模型为 Qwen3.5 系列。
  - 模型命名保留来源供应商前缀语义（如 `dashscope/qwen3.5-plus`）。
  - NextClaw 侧必须内置并集成该 provider（不仅是单独部署一个 Worker）。
- 已确认额度策略：
  - 免费额度按 USD 成本总额控制（一次性体验额度），不采用“按天重置”。
  - 月额度作为后续可选策略，不在首期 MVP 落地范围。
- 已确认账号体系范围：
  - 首期不做登录、API Key 自助创建、用量后台等账户系统能力。
  - 但接口和数据结构预留后续演进空间（向 OpenRouter/中转站形态演进）。
- 已确认限流与风控原则：
  - IP 不能作为主身份（个人电脑 IP 不稳定、NAT 共享会误伤）。
  - 主身份采用设备安装标识（如 `device_install_id`）+ 签名校验。
  - IP 仅作为风控辅助信号，不作为唯一限额键。

## 2) 测试/验证/验收方式
- 本迭代为文档方案迭代，未涉及运行时代码变更，因此 `build/lint/tsc` 在本迭代标记为不适用。
- 文档结构验收：
  - 已创建新迭代目录：`docs/logs/2026-03-05-nextclaw-builtin-provider-gateway`
  - 已创建版本子目录：`v0.0.1-nextclaw-builtin-provider-gateway-plan`
  - 已在版本目录内提供单文档：`ITERATION.md`
- 方案内容验收（评审清单）：
  - 是否明确“NextClaw 内置 provider + Worker 网关”是同一交付目标。
  - 是否明确“免费额度按 USD 总额度”而非日额度。
  - 是否明确首期不做登录与自助 API Key 管理。
  - 是否明确 IP 仅做风控辅助，不做主身份。

## 3) 发布/部署方式
- 本迭代仅文档更新，无需部署。
- 下一实现迭代的发布闭环预告（执行时再落地）：
  - 发布 Worker 网关服务（含模型路由与额度校验）。
  - 发布 NextClaw 内置 provider 集成（默认 provider 与默认模型可直接使用）。
  - 执行最小可运行冒烟：安装后直接发起一次模型调用并验证额度扣减。

## 4) 用户/产品视角的验收步骤
1. 安装并启动 NextClaw（不手动配置第三方 Key）。
2. 在 Provider 列表中看到内置的 NextClaw provider（默认可用）。
3. 直接选择首期内置模型并发起对话，确认可以返回结果。
4. 连续请求直到体验额度耗尽，确认返回“额度已用尽/需升级”提示。
5. 切换网络（IP 变化）后，确认设备身份与额度状态保持一致，不因 IP 变化误判为新用户。
