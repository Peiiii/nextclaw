# Hermes Bridge Extraction From Stdio Client Plan

## 背景

当前 `@nextclaw/nextclaw-ncp-runtime-stdio-client` 里混入了 Hermes 专属实现：

- `hermes-acp-route-bridge.utils.ts`
- `hermes-acp-route-bridge/sitecustomize.py`
- Hermes ACP 命令识别
- Hermes probe 假路由注入
- `PYTHONPATH` / `sitecustomize` 自动注入

这违反了分层目标：

- `narp-stdio` 是通用 runtime type
- `stdio client` 是通用执行层
- Hermes 只是某一个具体验证对象/接入对象

因此当前结构会造成错误后果：

- 通用 stdio client 被 Hermes 污染
- 后续若再接别的 ACP/stdin runtime，会继续在通用层塞专属逻辑
- 技能与产品心智会误以为“stdio client 自带 Hermes 适配”

## 目标

本次整改后必须满足以下条件：

1. `@nextclaw/nextclaw-ncp-runtime-stdio-client` 内不再出现 Hermes 专属逻辑
2. `stdio client` 只保留通用能力：
   - 解析 stdio config
   - 启动/探测子进程
   - 通过 ACP 收发通用事件
   - 注入通用 `RuntimeRoute` 环境变量
3. Hermes 专属 bridge 拆到独立包
4. Hermes 的 bridge 使用由 Hermes 接入路径显式承担，而不是 stdio client 暗中自动承担
5. `Hermes` 现有主链仍保持可用：
   - `narp-stdio(acp)`
   - `model / apiBase / apiKey / headers` 继续真实透传

## 明确设计

### 1. 保留的通用层

保留在 `@nextclaw/nextclaw-ncp-runtime-stdio-client`：

- `StdioRuntimeConfigResolver`
- `StdioRuntimeNcpAgentRuntime`
- `probeStdioRuntime`
- 通用 `RuntimeRoute -> env` 注入

这里的通用 env bridge 只负责把 NextClaw 已解析好的路由映射成标准环境变量：

- `NEXTCLAW_MODEL`
- `NEXTCLAW_API_BASE`
- `NEXTCLAW_API_KEY`
- `NEXTCLAW_HEADERS_JSON`

这是通用运行时合同的一部分，不属于 Hermes 特供逻辑。

### 2. 新增独立 Hermes bridge 包

新增包：

- `packages/nextclaw-hermes-acp-bridge`

职责仅限于 Hermes ACP 专属适配：

- 识别某个 stdio 配置是否在启动 `hermes acp`
- 为 Hermes ACP 生成额外 launch env
- 为 Hermes probe 生成假路由 env
- 提供 `sitecustomize.py`
- 复制 Python bridge 资源到 `dist`

它不是 plugin，不是 runtime type，也不是通用 stdio client 的一部分。

### 3. Hermes 接入点如何使用 bridge

Hermes bridge 由 NextClaw 的 builtin runtime registration 显式接入：

- 在 builtin `narp-stdio` entry 创建路径中
- 如果 entry 配置实际启动的是 `hermes acp`
- 则在创建 runtime 前，为该 entry 追加 Hermes bridge 所需 env
- probe 路径也同样显式追加 Hermes bridge env

这样：

- 通用 stdio client 不认识 Hermes
- Hermes entry 仍能正确使用桥接

### 4. 不做的事

- 不修改 Hermes 仓库本体代码
- 不把 Hermes bridge 继续塞回 `stdio client`
- 不把 Hermes bridge 做成 plugin
- 不新增新的用户可见复杂配置面

## 实施步骤

1. 新增 `@nextclaw/nextclaw-hermes-acp-bridge`
2. 把以下内容从 stdio client 搬过去：
   - `hermes-acp-route-bridge.utils.ts`
   - `sitecustomize.py`
   - `copy-hermes-acp-route-bridge.mjs`
   - 对应测试
3. 改造 stdio client：
   - 删除 Hermes 专属 import
   - `spawn/probe` 改为只使用通用 env bridge
4. 改造 builtin NARP registration：
   - Hermes entry 创建时显式调用 Hermes bridge 包
   - Hermes entry probe 时显式调用 Hermes bridge 包
5. 更新技能与文档：
   - 明确 bridge 是 Hermes 专属包，不是 stdio client 自带魔法
6. 运行验证

## 验证标准

必须同时满足：

1. `stdio client` 代码内不再出现：
   - `hermes`
   - `sitecustomize`
   - Hermes ACP probe 假路由逻辑
2. 新包 `nextclaw-hermes-acp-bridge` 自身测试通过
3. `nextclaw-ncp-runtime-stdio-client` 测试/类型检查通过
4. `nextclaw` 包类型检查通过
5. Hermes runtime smoke 继续通过
6. mock 上游仍能看到：
   - `Authorization`
   - `model`
   - 自定义 `headers`

## 完成判定

只有同时满足下面两条，才算整改完成：

1. 通用 stdio client 已恢复纯通用
2. Hermes 主链仍保持可用且无需修改 Hermes 本体
