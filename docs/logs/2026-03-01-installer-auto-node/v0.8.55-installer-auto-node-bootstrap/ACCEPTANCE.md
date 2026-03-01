# 用户 / 产品视角验收步骤

## 验收前提

- 准备一台未安装 Node.js 的 macOS（建议新用户环境）。

## 步骤

1. 下载并双击安装 `NextClaw-*-macos-*-installer.pkg`。
2. 打开 `/Applications/NextClaw/Start NextClaw.command`。
3. 观察首次启动：
   - 若系统无 Node，会看到自动安装 Node 的提示。
   - 安装完成后自动继续启动 NextClaw。
4. 浏览器应自动打开 `http://127.0.0.1:18791`。
5. 在终端执行 `/Applications/NextClaw/nextclaw --help`，确认命令可运行。
6. 执行一次依赖 npm/npx 的能力（如 skill/plugin 安装），确认无需用户手动先装 Node。

## 通过标准

- 用户不需要预装 Node/npm/npx。
- 用户仅通过安装器 + 启动脚本即可成功使用。
- 安装包体积相较内置 runtime 方案明显降低。
