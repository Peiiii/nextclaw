---
name: proxy-local-ai-subscriptions
description: 当用户希望把本机 Codex、ChatGPT Codex 或 Claude Code 订阅通过 localhost 暴露为 OpenAI 兼容端点，或希望在代理验证成功后把它添加成 NextClaw 自定义 provider 时使用。负责 CLIProxyAPI 安装检查、安全配置、OAuth 登录、模型发现、真实回复冒烟、NextClaw provider 事务式写入与 NCP 真实对话验收；不用于公网共享、转售、绕过配额或多用户账号池。
---

# Proxy Local AI Subscriptions

把本机订阅接成受保护的 OpenAI 兼容端点，并在用户明确同意后接入 NextClaw。代理运行时固定使用 [router-for-me/CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)；本 skill 只负责接入、校验和故障诊断，不复制代理实现。

## 安全边界

- 只绑定 `127.0.0.1`，不支持公网、局域网、容器跨主机或反向隧道暴露。
- 只供当前用户本人使用。若用户要求共享账号、转售、规避订阅限制或绕过配额，停止并建议使用官方 API。
- OAuth token 只保存在 CLIProxyAPI 的 auth 目录；NextClaw 只保存代理生成的本地 API key。
- 不在命令行参数、聊天回复或日志里展示 API key。所有 bundled scripts 通过 mode `0600` 的 key 文件交换密钥。
- 当前审计与真实验收基线是 CLIProxyAPI `v7.2.90`。`check` 只自动接受 `7.2.x`；其他版本必须重新审计官方配置和登录合同后，才可用 `--allow-unaudited-version` 继续。
- Marketplace 安装只复制 skill 文件，不代表代理已经安装或登录。必须完成下面的真实验证后才能宣告可用。

## 工作流

### 1. 先做只读检查

确认操作系统、`cliproxyapi`、`nextclaw` 和当前服务状态。不要先改配置或重启服务。

macOS 首选官方 Homebrew formula：

```bash
brew info cliproxyapi --json=v2
```

若缺失，说明将安装第三方 MIT 工具及其用途，得到用户同意后执行：

```bash
brew install cliproxyapi
```

Linux/Windows 必须使用 CLIProxyAPI 官方发布物或官方安装说明，并把真实二进制与配置路径显式传给 bundled scripts。本版只对 macOS Homebrew 持久服务路径做过端到端验收，不要把其他平台描述为已验证。

### 2. 生成 localhost-only 配置

从本 skill 目录运行：

```bash
node scripts/cliproxy.mjs write-config \
  --config "$(brew --prefix)/etc/cliproxyapi.conf" \
  --auth-dir "$HOME/.cli-proxy-api" \
  --api-key-file "$HOME/.cli-proxy-api/nextclaw-api-key"
```

脚本会生成本地 API key、把 key 与配置设为 `0600`、关闭管理 API/控制面板，并把 factory template 自动备份后替换。若配置属于用户已有环境，脚本会拒绝覆盖；先解释差异并取得明确同意，才可加 `--force`。不要手写 YAML，也不要绕过备份保护。

若已存在运行中的 CLIProxyAPI，修改或重启前先告知会短暂中断该代理。不要擅自复用另一个实例的端口、auth 目录或 API key。

### 3. 完成订阅 OAuth

Codex：

```bash
cliproxyapi \
  --config "$(brew --prefix)/etc/cliproxyapi.conf" \
  --codex-login
```

Claude Code：

```bash
cliproxyapi \
  --config "$(brew --prefix)/etc/cliproxyapi.conf" \
  --claude-login
```

没有图形浏览器时加 `--no-browser`，把官方 OAuth URL 交给用户本人完成。不要读取、复制或展示 token 文件内容。默认只登录用户指定的一个账号；不要主动建立多账号轮询池。

### 4. 启动并验证代理

macOS Homebrew：

```bash
brew services start cliproxyapi
```

如果服务已在运行且配置发生变化，先告知影响，再执行 `brew services restart cliproxyapi`。

先做就绪检查：

```bash
node scripts/cliproxy.mjs check \
  --config "$(brew --prefix)/etc/cliproxyapi.conf" \
  --endpoint http://127.0.0.1:8317/v1 \
  --api-key-file "$HOME/.cli-proxy-api/nextclaw-api-key"
```

从输出的 `models` 中选择真实存在的模型，再跑 Responses API 真实回复：

```bash
node scripts/cliproxy.mjs smoke \
  --endpoint http://127.0.0.1:8317/v1 \
  --api-key-file "$HOME/.cli-proxy-api/nextclaw-api-key" \
  --model <raw-model-id>
```

只有 `check.ok=true`、模型列表非空、`smoke.ok=true` 且回复精确命中 marker，才算代理可用。失败时按 `binary -> config safety -> OAuth model list -> Responses API` 顺序缩圈，不要跳过上游直连就改 NextClaw。

### 5. 询问是否接入 NextClaw

代理真实回复成功后，必须明确询问：

> 本地 OpenAI 兼容端点已经验证成功。是否现在把它添加为 NextClaw provider？

用户没有明确同意时停止，不写 NextClaw 配置，也不改变默认模型。

用户同意后执行：

```bash
node scripts/nextclaw-provider.mjs \
  --endpoint http://127.0.0.1:8317/v1 \
  --api-key-file "$HOME/.cli-proxy-api/nextclaw-api-key" \
  --model <raw-model-id>
```

脚本默认从 `nextclaw status --json` 读取当前 API 地址，使用 provider id `local-subscriptions` 和 `wireApi=chat`。代理直连仍用 Responses API 证明 OpenAI 端点成立，但 NextClaw `native` 会携带工具定义；本次真实验收确认 Chat Completions wire 能保持工具 schema 兼容。脚本会发现模型、先对候选配置执行真实 provider test，成功后才启用；新建 provider 在失败时自动删除回滚。若同名 provider 已指向其他端点，必须先解释冲突并获得同意，才可加 `--replace-existing`。

随后必须走 `native` session type 做一次 NCP 真实对话：

```bash
node scripts/nextclaw-smoke.mjs \
  --model local-subscriptions/<raw-model-id>
```

只有 provider test 和 NCP 最终回复都通过，才能说“已可在 NextClaw 使用”。不要因为 `/api/health`、模型列表或编译通过就宣告完成。

## 完成报告

报告以下事实，不输出任何 secret：

- CLIProxyAPI 版本、配置路径、auth 目录、监听地址；
- OAuth 类型（Codex 或 Claude），不要输出账号 token；
- 真实验证的 raw model id 与 OpenAI wire；
- 是否创建/更新 `local-subscriptions` provider；
- NCP session type 必须是 `native`，模型必须是 `local-subscriptions/<raw-model-id>`；
- 未验证的平台或能力（例如本次只验 Codex，就明确 Claude 未做真实验收）。

## 故障与退出

- `check` 报非 localhost 配置：停止服务并修复绑定；不要带风险继续。
- `/v1/models` 为空：重新执行对应 OAuth 登录并检查 auth 目录，不要猜模型名。
- 代理直连成功但 provider test 失败：检查 `apiBase` 是否带 `/v1`、模型是否 provider-scoped、`wireApi` 是否为 `chat`。
- provider test 成功但 NCP 失败：按 NextClaw NCP SSE 链路排查；不要把问题归因成 OAuth 已失效。
- 删除 provider、恢复备份配置、注销 OAuth 或卸载 CLIProxyAPI 都是破坏性动作，只在用户明确要求后执行。
