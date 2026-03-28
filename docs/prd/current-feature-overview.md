# NextClaw 当前功能概览（2026-02）

> 文档定位：用于“梳理 + 宣传”的产品概览，不是研发任务清单。

## 1. 产品一句话

**NextClaw 是一个 UI-first、轻量化、可维护优先的个人 AI 助手网关。**

核心体验是：安装后执行一次 `nextclaw start`，其余配置（模型、Provider、渠道）主要在浏览器中完成。

## 2. 当前能力版图（已上线）

### A. 启动与运行体验

- 一键启动：`nextclaw start`（后台运行网关 + UI）
- 前台模式：`nextclaw serve` / `nextclaw ui` / `nextclaw gateway`
- 生命周期管理：`start / restart / stop / status / doctor`
- 运行状态诊断：进程状态、端口占用、配置可用性、Provider 准备度检查

**用户价值**：降低上手成本，减少命令行操作负担，提升可运维性。

### B. 配置与管理 UI

- 内置 Web UI（默认 `http://127.0.0.1:55667`）
- 聚合配置：模型、Providers、Channels
- UI 后端 API：配置读取、模型修改、Provider 更新、Channel 更新
- WebSocket 推送配置变更，前端自动刷新视图

**用户价值**：把“改 JSON 配置文件”转为“可视化配置流程”。

### C. 模型与 Provider 能力

- 支持主流 Provider：OpenRouter、OpenAI、Anthropic、MiniMax、Moonshot、Gemini、DeepSeek、DashScope、Zhipu、Groq、vLLM、AiHubMix
- 统一配置结构（`providers.*`）
- OpenAI Provider 支持 `wireApi` 选择（`auto / chat / responses`）
- Provider 参数变更支持运行时应用（无需重启）

**用户价值**：模型选择灵活，切换与试错成本低。

### D. 智能体核心能力

- 对话模式：CLI 单轮 + CLI 交互式
- 内置工具族：
  - 文件操作（读/写/改/列目录）
  - Shell 执行
  - Web 搜索与网页抓取
  - 消息发送
  - Cron 调度
  - Session 查询与回看
  - Memory 检索
  - Subagent（子代理）任务编排
  - Gateway 控制工具（配置/重启/更新入口）

**用户价值**：不仅能聊天，还能执行任务与持续自动化。

### E. 多渠道接入能力

- 内置渠道：Telegram、Discord、WhatsApp、Feishu、DingTalk、Slack、Email、QQ、Weixin、Mochat
- 渠道启停与参数集中在 `channels.*`
- `allowFrom` 白名单机制（渠道级访问控制）
- `channels status` / `channels login` 形成基础运维闭环

**用户价值**：同一助手可服务多个沟通入口，减少工具切换。

### F. 自动化能力

- Cron：一次性任务、固定间隔任务、cron 表达式任务
- Heartbeat：周期读取工作区任务文件，触发主动执行

**用户价值**：从“被动问答”升级为“定时与主动执行”。

### G. 架构简化（插件兼容层已移除）

- 已移除 OpenClaw 插件兼容加载链路与相关 CLI 命令
- 运行时仅保留内置能力，配置与诊断路径更收敛
- 减少跨模块耦合点，降低长期维护复杂度

**用户价值**：行为更确定、故障面更小、升级风险更低。

## 3. 当前边界与限制（如实说明）

### 3.1 无外部插件扩展入口

- 不再提供 `nextclaw plugins *` 命令
- 不再加载 OpenClaw 插件与插件渠道适配逻辑

### 3.2 扩展策略以内建能力演进为主

- 新能力通过核心模块迭代交付
- 优先保证可维护性、一致性与测试可控性

## 4. 对外传播建议口径（可直接复用）

### 口径 1（简版）

**NextClaw：一条命令启动、一个 UI 完成配置、可维护优先的轻量 AI 助手网关。**

### 口径 2（场景版）

如果你想要多渠道与多模型能力，但不想引入复杂插件系统，NextClaw 是更快上手、更易维护的选择。

## 5. 典型使用场景

- **个人 AI 中枢**：同一助手接入 Telegram/Slack/Email，统一处理消息与任务。
- **快速试验台**：在 UI 中快速切换 Provider/模型，验证效果后再固化配置。
- **轻自动化运维**：用 Cron + Heartbeat 将固定提醒/巡检任务自动化。

## 6. 版本说明

- 本文档基于当前仓库实现与文档状态整理（2026-02-18）。
- 本文档属于“概览层”，不替代详细使用文档（`docs/USAGE.md`）。
