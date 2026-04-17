# 快速开始

## 0. 前置准备（新手必读）

NextClaw 依赖 Node.js 与 npm。

1. 安装 Node.js（推荐 LTS 版本）：[nodejs.org](https://nodejs.org/)
2. 安装完成后，打开终端执行：

```bash
node -v
npm -v
```

看到版本号即表示环境正常（例如 `v20.x`、`10.x`）。

## 1. 打开终端

- Windows：
  - 按 `Win + R`，输入 `cmd` 后回车；
  - 或搜索并打开 `PowerShell`。
- macOS：按 `Command + 空格`，输入 `Terminal`（终端）并回车。
- Linux：通常使用 `Ctrl + Alt + T`，或在应用菜单中打开 `Terminal`。

## 2. 安装 NextClaw

```bash
npm i -g nextclaw
```

如果你是在 Debian / Ubuntu 系 Linux 上安装桌面版，而不是 CLI，请改看：

- [Linux 桌面安装（.deb + APT）](/zh/guide/tutorials/linux-desktop-deb-apt)

## 3. 启动服务

后台启动网关 + 配置 UI：

```bash
nextclaw start
```

## 4. 打开 UI 并完成首次配置

浏览器访问 **http://127.0.0.1:55667**，按以下顺序完成初始化：

1. 添加 Provider（如 Qwen Portal / MiniMax / OpenRouter / OpenAI）
   - 如果你安装后不知道先选哪条路，先看：[安装后第一步：先选接入方式（Qwen Portal 或 API Key）](/zh/guide/tutorials/provider-options)
   - 如果你的目标是接入 `Claude Code / Codex / Hermes`，直接看：[Claude Code / Codex / Hermes 集成](/zh/guide/tutorials/claude-codex-hermes)
2. 选择默认模型
3. 保存配置并发起第一条消息

## 5. 常用验证与停止命令

```bash
nextclaw --version
nextclaw status
nextclaw stop
```

## 6. 常见问题

### `npm` / `node` 命令不存在

说明 Node.js 未安装成功，或终端未重启。请重新安装 Node.js 并重开终端。

### `EACCES`（macOS/Linux 全局安装权限问题）

可先尝试使用官方安装包重装 Node.js；若仍报错，再参考 npm 官方文档配置全局目录权限。

### `http://127.0.0.1:55667` 打不开

1. 先运行 `nextclaw status` 确认服务是否已启动。
2. 若未启动，执行：

```bash
nextclaw start
```

3. 若仍无法访问，执行：

```bash
nextclaw stop
nextclaw start
```

## 下一步

- [配置后做什么](/zh/guide/after-setup) — 配置完成后的第一批任务建议
- [生态资源](/zh/guide/resources) — OpenClaw 生态项目与 awesome 资源导航
- [配置](/zh/guide/configuration) — Provider、模型、工作区
- [密钥管理](/zh/guide/secrets) — 避免明文密钥，支持安全轮换
- [渠道](/zh/guide/channels) — 连接 Discord、Telegram、Slack 等
- [命令](/zh/guide/commands) — CLI 参考
