# Hermes ACP RuntimeRoute Bridge Design

**Goal:** 把 `Hermes` 在 NextClaw 中的正式接入主链锁定为 `narp-stdio(acp)`，并通过一层极薄的 Python bridge 让 `Hermes ACP` 直接消费 NextClaw 已解析好的 `RuntimeRoute(model/apiBase/apiKey/headers)`。  
**Status:** 这份文档是当前批次唯一有效的 Hermes stdio 主方案设计。后续实现、skill、验证、验收一律以本文件为准。  
**Vision alignment:** 这条方案服务于 NextClaw “统一入口、统一模型选择、统一凭据 ownership、统一会话体验”的产品目标。用户看到的是正式的 `Hermes` session type，而不是插件、connector、API server 或额外私有配置系统。

---

## 1. 这份文档锁定什么

这份文档一次性锁定以下结论：

1. `Hermes` 的正式产品主路径是 `narp-stdio`，底层 wire dialect 为 `acp`
2. `Hermes` 的标准 runtime entry 直接启动 `hermes acp`
3. `NextClaw` 才是 `model / apiBase / apiKey / headers` 的 owner
4. `Hermes ACP` 必须消费 NextClaw 的 `RuntimeRoute`，不能重新退回 Hermes 自己的 provider 解析主语
5. 允许存在一层极薄的 Python bridge/launcher 来完成这件事，而且这层 bridge 必须位于 Hermes 专属包中，不能污染通用 stdio client
6. `API server`、`HTTP adapter`、`stdio connector -> API server` 都不是这条主链的产品主语

---

## 2. 当前纠偏结论

这轮必须明确纠偏两件事。

### 2.1 正确主链不是 API server 方案

以下链路不是本方案的正式主链：

`NextClaw -> stdio connector -> Hermes API server`

它可以作为历史过渡实现或辅助验证路径存在过，但它不是当前要求交付的正式产品主路径。

### 2.2 正确主链是 Hermes ACP 直连

本方案要求的正式主链是：

`NextClaw runtime entry (type: "narp-stdio")`
-> `hermes acp`
-> `Hermes ACP session`
-> `Hermes AIAgent`
-> `上游模型 API`

其中：

- `stdio` 是 transport
- `acp` 是 wire dialect
- `Hermes` 是 runtime entry 的用途/label
- `RuntimeRoute` 来自 NextClaw，而不是 Hermes 自己的配置系统

---

## 3. 顶层设计

### 3.1 Product Contract

NextClaw 中的 `Hermes` 是统一 runtime registry 里的一条正式 entry。

推荐 entry 形态：

```json
{
  "agents": {
    "runtimes": {
      "entries": {
        "hermes": {
          "enabled": true,
          "label": "Hermes",
          "type": "narp-stdio",
          "config": {
            "wireDialect": "acp",
            "processScope": "per-session",
            "command": "hermes",
            "args": ["acp"],
            "env": {},
            "startupTimeoutMs": 8000,
            "probeTimeoutMs": 3000,
            "requestTimeoutMs": 120000
          }
        }
      }
    }
  }
}
```

这里的关键不是某个 launcher 字符串，而是下面四条约束：

1. `type` 必须是 `narp-stdio`
2. `wireDialect` 必须是 `acp`
3. 启动目标必须是 `hermes acp`
4. `RuntimeRoute` 必须由 NextClaw 通过内建环境变量桥接进去，不需要用户显式配置字段名
5. Hermes 专属 Python bridge 必须由独立 Hermes bridge 包承载，`@nextclaw/nextclaw-ncp-runtime-stdio-client` 只保留通用 stdio 运行时职责

### 3.2 RuntimeRoute Contract

Hermes ACP 必须消费的是统一产品合同，而不是 Hermes 私有 provider 选择结果：

```ts
type RuntimeRoute = {
  model: string;
  apiBase: string | null;
  apiKey: string | null;
  headers: Record<string, string>;
};
```

必须满足：

- `model` 由 NextClaw 当前选中的模型决定
- `apiBase` 由 NextClaw 当前 provider/base 配置决定
- `apiKey` 由 NextClaw 当前 provider 凭据决定
- `headers` 必须支持完整透传

---

## 4. 薄 Python Bridge 的职责

### 4.1 为什么需要 bridge

Hermes 现有 `acp_adapter/session.py` 在创建 `AIAgent` 时，默认仍会：

1. 读取 Hermes 自己的 `config.yaml`
2. 调用 Hermes 自己的 `resolve_runtime_provider(...)`
3. 再把解析结果塞给 `AIAgent`

这与我们的产品合同冲突，因为我们的要求是：

- NextClaw 负责 provider/base/key/model 的选择
- Hermes 只负责消费这份已解好的 route

所以需要一层极薄的 bridge，在 `hermes acp` 启动时把这层 ownership 改正过来。

### 4.2 Bridge 的允许形态

Bridge 可以是以下任一等价实现：

- Python launcher
- `sitecustomize.py` monkeypatch
- 极小的 Hermes ACP 创建链 patch

但不管具体形态如何，它都必须放在 Hermes 专属包中，由 builtin Hermes runtime entry 显式启用，而不是把 Hermes 判断逻辑内嵌进通用 stdio client。

这层 bridge 的唯一职责是：

1. 读取 NextClaw 注入的环境变量
2. 把这些值变成 `AIAgent(...)` 的显式 runtime 参数
3. 优先使用这些显式参数，而不是继续先走 Hermes 自己的 provider resolution
4. 在 Hermes ACP 对外事件语义和 NextClaw/NCP 合同不一致时，只在 Hermes 专属 bridge 内做最小必要协议映射，例如把误接到 ACP thought 事件里的瞬时 `thinking_callback` 重映射到真实 reasoning 通道，而不是修改 Hermes 源码或污染通用 stdio client

### 4.3 Bridge 必须完成的事情

Bridge 必须显式消费：

- `NEXTCLAW_MODEL`
- `NEXTCLAW_API_BASE`
- `NEXTCLAW_API_KEY`
- `NEXTCLAW_HEADERS_JSON`

并将其转成 `AIAgent` 可实际使用的能力：

- `model`
- `base_url`
- `api_key`
- `provider`
- `api_mode`
- `default_headers`

### 4.4 Bridge 不应该做的事

Bridge 不应该：

- 变成第二套 runtime 系统
- 引入一个新的产品配置面
- 要求用户单独再给 Hermes 配一套 provider
- 把 API server 重新引回主链
- 把 connector 重新引回主链

---

## 5. Provider Ownership 规则

必须写死以下 ownership：

### 5.1 NextClaw owns

- 模型选择
- `apiBase`
- `apiKey`
- 自定义 `headers`
- runtime entry 选择

### 5.2 Hermes owns

- ACP session 生命周期
- agent 执行与工具调用
- 流式 reasoning / text / tool events
- 会话内部状态

### 5.3 Hermes 不再拥有

在这条集成路径里，Hermes 不再拥有最终 provider 选择权。

也就是说：

- Hermes 可以继续保留自己原生的 provider/config 能力，供 Hermes 自己 standalone 使用
- 但当它被 NextClaw 以 `narp-stdio(acp)` 启动时，必须优先消费 NextClaw 的 `RuntimeRoute`

---

## 6. Skill Contract

`hermes-runtime` skill 必须按这条正式主链描述和执行，不得再把 API server/connector 叙事当成主语。

skill 的 setup / doctor / repair / smoke 必须围绕下面这条真实路径：

1. 检查 `hermes` 是否已安装
2. 检查 `hermes acp` 是否可启动
3. 写入或修复 `agents.runtimes.entries.hermes`
4. 确认 `Hermes` 出现在 `/api/ncp/session-types`
5. 跑真实首聊 smoke
6. 必要时发起独立二次验证

skill 不应再要求：

- 启动 Hermes API server
- 安装 `nextclaw-hermes-stdio-connector`
- 维护 connector 专属命令

---

## 7. 开发态与发布态约束

### 7.1 开发态

开发态主链也必须保持同构：

- 直接运行 `hermes acp`
- 使用同一套 RuntimeRoute bridge
- 不允许开发态继续把 `API server + connector` 伪装成正式主链

### 7.2 发布态

发布态需要保证：

- `@nextclaw/nextclaw-ncp-runtime-stdio-client` 自带 bridge 所需资源
- 用户安装 NextClaw 后，不需要额外安装 first-party connector 包
- `Hermes` 只需按官方路径安装一次，随后由 skill 或手工 entry 配置接入

---

## 8. 验收标准

只有同时满足以下条件，才算交付完成：

1. `Hermes` 作为 `narp-stdio` entry 能在 NextClaw 中显示为正式 session type
2. runtime entry 直接启动的是 `hermes acp`，而不是 connector
3. `model / apiBase / apiKey / headers` 都由 NextClaw 透传给 Hermes ACP
4. Hermes 不再要求额外独立 provider 配置才能完成这条链
5. 真实首聊成功
6. skill 文档与执行剧本严格与本方案一致

---

## 9. 明确废止的旧叙事

以下叙事从本方案起不再是正式主路径：

- `Hermes API server + stdio connector` 作为 Hermes stdio 主链
- `nextclaw-hermes-stdio-connector` 作为 Hermes 正式 runtime entry 的推荐 command
- “先检查 API server，再接入 Hermes” 作为默认 setup 心智
- 把 Hermes 的集成主语写成 connector 或插件

这些内容若仍出现在 skill、设计文档、dev 脚本、README 或验证脚本中，都视为需要回收的偏差。

---

## 10. 这轮实施范围

本轮必须完成：

1. 新方案文档落地
2. `narp-stdio` 中加入 Hermes ACP RuntimeRoute bridge
3. `hermes-runtime` skill 改写到新主链
4. 回收偏掉的 API server/connector 主链叙事与默认路径
5. 真实验证 `hermes acp` 路径确实吃到 NextClaw 的 route

本轮不要求：

- 一次性删除 Hermes HTTP 路径的全部历史代码
- 改造 Hermes 上游仓库公开发布新的官方版本

但必须保证：

- 当前 NextClaw 主链已经不再依赖这些偏掉路径
- 用户和 AI 不会再被错误地引导到旧叙事
