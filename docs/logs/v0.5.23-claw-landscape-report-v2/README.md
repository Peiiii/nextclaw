# 2026-02-16 Claw 生态用户视角对比报告 v2（补插件/Skills）

## 任务 / 范围

- 目标：对 OpenClaw / Moltis / IronClaw / ZeroClaw / NanoClaw / PicoClaw / ZeptoClaw / nextclaw 做用户视角功能对比与完善度评估，并补充“插件/Skills/扩展生态”对比。
- 视角：以“普通用户能否快速上手、功能是否完整、日常使用是否顺滑”为核心，不做开发者代码审计式解读。
- 资料来源：各项目公开仓库 README / 文档；本地已拉取仓库位于 `/Users/peiwang/Projects/claw-repos`。

## 仓库获取情况

- ✅ OpenClaw（`openclaw/openclaw`）
- ✅ Moltis（`moltis-org/moltis`）
- ✅ ZeroClaw（`openagen/zeroclaw`）
- ✅ NanoClaw（`qwibitai/nanoclaw`）
- ✅ PicoClaw（`sipeed/picoclaw`）
- ✅ ZeptoClaw（`qhkm/zeptoclaw`）
- ⚠️ IronClaw：暂未找到公开仓库（如有官方地址请补充）
- ✅ nextclaw：本仓库（`/Users/peiwang/Projects/nextbot`）

## 结论摘要（用户视角）

- **OpenClaw** 功能面最全（渠道、端侧、可视化、技能生态），但上手与运维成本最高。
- **Rust 系（Moltis / ZeptoClaw / ZeroClaw）** 是“功能 + 安全 + 轻量”的中间态，功能比极简系更全，但生态规模仍不及 OpenClaw。
- **极简系（NanoClaw / PicoClaw）** 强在轻量与清晰边界，牺牲功能广度与 UI 体验。
- **nextclaw** 的核心差异依旧是“最快上手 + UI-first + 多通道多模型”，插件/扩展生态目前仍是短板（有规划但尚未落地）。

## 扩展生态（插件 / Skills）对比

符号：✅ 明确支持 / 🟡 有相关机制但不完整或依赖外部 / ⚪ 未提及或不确定 / 🧭 规划中

| 项目 | Skills（技能） | 插件/扩展系统 | 备注（用户感知） |
| --- | --- | --- | --- |
| OpenClaw | ✅ | 🟡 | 有 skills 平台（bundled/managed/workspace + ClawHub），插件/扩展生态存在但 README 主要强调 skills |
| Moltis | ✅ | ✅ | README 明确有 skills + plugins + hooks，用户可在 UI/CLI 管理 |
| ZeroClaw | ✅ | 🟡 | Skills loader 明确；Integrations registry 提到插件系统，但未突出用户入口 |
| NanoClaw | 🟡 | ⚪ | 主要靠 Claude Code skills（外部技能），不强调内置插件系统 |
| PicoClaw | 🟡 | ⚪ | Workspace 有 skills 目录，未强调插件系统 |
| ZeptoClaw | 🟡 | ✅ | 有插件系统（`~/.zeptoclaw/plugins`），skills 以迁移/导入为主 |
| nextclaw | ✅ | 🧭 | 有 ClawHub skills install + workspace skills；OpenClaw 插件兼容在规划中 |

## OpenClaw 功能覆盖清单（用户视角）

说明：仅基于 README/文档可见内容；“⚪”表示未明确提及（不是断言不支持）。

### 核心能力

| 能力 | OpenClaw | Moltis | ZeroClaw | NanoClaw | PicoClaw | ZeptoClaw | nextclaw |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 上手体验（向导/一键） | ✅ 向导 | ✅ 向导/零配置 | ✅ CLI 快速 | ✅ Claude Code | ✅ 快速 | ✅ 一键安装 | ✅ 一键启动 + UI |
| Web UI / 可视化 | ✅ 控制台 + Canvas | ✅ 内置 UI | ⚪ | ⚪ | 🟡 基础 UI/CLI | ⚪ | ✅ 内置配置 UI |
| 多通道 | ✅ 很全 | 🟡 当前以 Telegram 为主 | ✅ 多通道 | ⚪ WhatsApp 单通道 | 🟡 Telegram/Discord/LINE/DingTalk | 🟡 5 通道 | ✅ 多通道 |
| 多模型/Provider | ✅ 很全 | ✅ | ✅ | 🟡 以 Claude 为主 | ✅ | ✅ | ✅ |
| 自动化（Cron/Heartbeat） | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 记忆/存储 | ✅ | ✅ | ✅ | 🟡 组内记忆 | ✅ | ✅ | 🟡 基础持久化 |
| 工具/执行（web/exec） | ✅ | ✅ | ✅ | 🟡 基础工具 | ✅ | ✅ | ✅ |
| 安全隔离/沙箱 | 🟡 应用层为主 | ✅ 容器隔离 | ✅ 安全策略 | ✅ 容器隔离 | 🟡 默认沙箱 | ✅ 多层安全 | 🟡 配置级限制 |

### 高阶能力

| 能力 | OpenClaw | Moltis | ZeroClaw | NanoClaw | PicoClaw | ZeptoClaw | nextclaw |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 语音（TTS/STT） | ✅ 多端 | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ |
| 端侧/多设备节点 | ✅ macOS/iOS/Android | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ |
| 插件/技能生态 | ✅ | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅/🧭 |
| Hooks/可观测 | ⚪ | ✅ | 🟡 | ⚪ | ⚪ | ✅ | ⚪ |
| MCP | ⚪ | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ |
| 多租户 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ✅ | ⚪ |

## 逐项目评估（用户视角，聚焦扩展生态）

### OpenClaw

- **Skills**：明确支持（bundled/managed/workspace + ClawHub）。
- **插件/扩展**：生态存在（扩展通道/技能），但 README 主线仍以 skills 为主。
- **用户感知**：功能极全，但学习成本和系统复杂度高。

### Moltis

- **Skills + Plugins + Hooks**：README 明确说明；并提供 UI 管理与 CLI。
- **用户感知**：功能完整且安全感强；生态规模仍在成长。

### ZeroClaw

- **Skills**：有 loader + 社区 skill packs。
- **Plugins**：Integrations registry 提到插件系统，但用户入口不突出。
- **用户感知**：功能不弱，但 UI/生态体验偏轻量。

### NanoClaw

- **Skills**：主张“skills over features”，依赖 Claude Code skills 进行改造。
- **插件**：未强调内置插件系统。
- **用户感知**：极简但可塑性强，适合单一渠道需求。

### PicoClaw

- **Skills**：workspace 有 skills 目录；生态指向 ClawdChat skills。
- **插件**：未强调插件系统。
- **用户感知**：轻量/硬件友好，但生态与安全成熟度仍不足。

### ZeptoClaw

- **Plugins**：JSON manifest 插件系统明确，自动发现目录。
- **Skills**：提到可从 OpenClaw 迁移技能。
- **用户感知**：安全与功能平衡，偏生产化。

### nextclaw

- **Skills**：有 ClawHub 安装与 workspace skills。
- **插件**：OpenClaw 插件兼容处于规划阶段（尚未落地）。
- **用户感知**：上手最快，生态扩展仍需补齐。

## 对 nextclaw 的建议（面向“用户选择你”的差异化）

1. **把“插件/扩展”讲清楚**：当前已支持 skills，但插件生态仍规划中；建议公开“能力路线图”，避免用户预期错位。
2. **用 UI 强化技能生态入口**：将 skills 安装做成 UI 一级入口（比 CLI 更直观）。
3. **安全叙事补位**：明确 sandbox/权限边界，让用户有“可信感”。
4. **用 1-2 个高感知扩展做示范**：比如“模板库 / 常见自动化包 / 一键接入 Gmail/Notion”。

## 风险 / 待确认

- IronClaw 未找到官方仓库或可验证资料，需要补充。
- 各项目功能覆盖仅基于 README/文档，不代表实际全部实现。

## 验证（怎么确认符合预期）

本次仅新增研究报告，无代码改动：

- build / lint / tsc：不适用
- 冒烟测试：不适用

## 发布 / 部署

- 本次为文档研究报告，不涉及发布流程。
