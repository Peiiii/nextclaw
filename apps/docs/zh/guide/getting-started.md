# 快速开始

这一页只做一件事：让你用最短路径确认 NextClaw 能跑、能打开、能得到一次可用回复。

## 1. 准备 Node.js

NextClaw 的 NPM 安装方式需要 Node.js 和 npm。

```bash
node -v
npm -v
```

如果命令不存在，先安装 Node.js LTS 版本，然后重新打开终端。

## 2. 安装 NextClaw

```bash
npm i -g nextclaw
```

这一步只安装 CLI，不会自动注册开机自启动。

## 3. 启动服务

```bash
nextclaw start
```

启动后打开：

```text
http://127.0.0.1:55667
```

## 4. 完成最小配置

在界面里完成三件事：

1. 添加一个模型提供方
2. 选择默认模型
3. 保存配置

如果你不知道选哪条接入路径，先看 [先选接入方式](/zh/guide/tutorials/provider-options)。

## 5. 发出第一条消息

在 UI 里发送一个真实问题，例如：

```text
帮我把今天要做的三件事整理成清单。
```

能得到一条正常回复，就说明最小跑通完成。

## 常用检查命令

```bash
nextclaw status
nextclaw doctor
nextclaw stop
```

更完整的命令说明见 [命令索引](/zh/guide/commands)。

## 下一步

- [第一个有用工作流](/zh/guide/after-setup)
- [配置模型提供方](/zh/guide/model-selection)
- [后台运行与自启动](/zh/guide/background-autostart)
