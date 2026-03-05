# v0.0.5-provider-plugin-data-driven-foundation

## 迭代完成说明（改了什么）

本迭代先记录方案与讨论成果，作为后续实现与验收基线：

1. 产品目标与边界
- 项目名称统一为 NextClaw（目录名 nextbot 仅为仓库路径）。
- NextClaw 需要“开箱即用”默认可用的内置 Provider（NextClaw Provider + Cloudflare Worker 网关）。
- 登录不是强制选项；不登录不能影响产品本身使用。
- 长期目标是演进为类似 OpenRouter/中转站能力（登录、API Key、用量统计、额度管理）。

2. 额度与风控策略
- 免费体验额度采用 USD 成本口径计费。
- 额度策略优先“总额度”或“月额度”，不采用“每日额度”。
- 现阶段主要目标是“快速体验”，不是长期无限使用。
- IP 不是可靠身份，不作为核心限流身份基准（动态 IP/NAT/共享出口会导致误伤与绕过）。

3. 鉴权与防绕过结论
- 仅按用户自填 apiKey 记账存在绕过风险（更换 key 可重置额度）。
- 正确方向是“服务端签发 + 可验证凭证 + 服务端记账账本”，而不是信任客户端任意 key。
- 登录体系后续可加，但保持“可选增强”而非强制路径。

4. qwen.chat.ai 方向
- 优先参考 OpenClaw 的 qwen portal OAuth/device-code 思路。
- 在 NextClaw 中以通用 Provider 能力实现，qwen.chat.ai 只是一个 Provider 实例。
- OpenClaw CLI 交互需改造为 NextClaw UI 授权交互。

5. 本次后续开发顺序（已确认）
- 先重构 Provider 架构为“纯数据驱动”。
- 将 Provider 提供能力拆到独立插件层（先单插件承载全部内置 Provider，后续按需再拆分）。
- 再接入 qwen.chat.ai Provider（UI 授权流程 + 运行时调用链路）。

## 测试/验证/验收方式

1. 方案一致性检查
- 对照本文件检查实现是否满足：
  - 登录非强制
  - 额度按 USD 成本
  - Provider 插件化 + 数据驱动
  - qwen.chat.ai 以 Provider 方式接入

2. 代码级验证（后续实现阶段执行）
- `pnpm -r build`
- `pnpm -r lint`
- `pnpm -r tsc`
- 关键路径冒烟：
  - UI Provider 列表/编辑/测试连接
  - 内置 NextClaw Provider 请求链路
  - Worker `/health`、`/v1/models`、`/v1/usage`、`/v1/chat/completions`

## 发布/部署方式

1. Worker 部署
- 使用一键命令：`pnpm deploy:llm-api-worker`
- 部署域名：`https://ai-gateway-api.nextclaw.io`

2. 包发布（按变更范围）
- 至少覆盖受影响包：`@nextclaw/core`、`@nextclaw/server`、`nextclaw-ui`、`nextclaw`
- 若有联动依赖升级，按同一轮发布保持版本一致。

## 用户/产品视角的验收步骤

1. 默认体验路径（无需登录）
- 全新安装/初始化 NextClaw。
- 打开 Provider 配置，确认内置 NextClaw Provider 可直接可用。
- 发送一条消息并得到模型回复。
- 查看用量接口，确认 USD 成本口径计入且额度生效。

2. Provider 架构路径
- 在 UI 中查看 Provider 列表，确认由后端元数据驱动而非前端硬编码。
- 新增/编辑自定义 Provider，确认模型与连接测试可工作。

3. qwen.chat.ai 路径（后续实现后）
- 在 UI 发起 qwen.chat.ai 授权。
- 完成授权后可选择对应 Provider 模型并正常对话。
- 未授权状态下不影响其它 Provider 的使用。
