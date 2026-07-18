# Agent Browser 内置 Skill 方案

## 背景

NextClaw 的 `web_search` 依赖用户配置搜索服务。当前即使所选服务未配置 API key，工具仍会出现在 Agent 的工具列表中，调用后才返回错误；Agent 也没有稳定规则去发现已经存在的 Agent Browser skill，用户因此会停在失败结果上。

Agent Browser 与 `web_search` 不是同一种能力：前者驱动真实浏览器，适合访问已知页面、动态站点和交互操作；后者适合开放式信息发现。两者不能在工具实现中伪装成彼此。

本方案中的 Agent Browser 专指外部 `agent-browser` CLI；`web_fetch`、Chrome/Edge DevTools MCP 和 Browser Connector 仍是独立能力，不能混称为 Agent Browser。

## 目标

- Agent 在调用前知道 `web_search` 是否就绪。
- `web_search` 不可用或请求失败时，Agent 能把 Agent Browser 作为独立路径继续评估。
- Agent Browser skill 随 NextClaw 内置，但不打包 Agent Browser 的代码、CLI 或浏览器二进制。
- 首次使用能完成检查、经用户同意后的安装、诊断、真实浏览和会话清理。
- 已安装的同名 workspace/Marketplace skill 不再形成第二套事实源。

## 方案

### 1. Tooling context 负责能力选择

`ToolingContextProvider` 根据本轮工具目录和搜索配置输出明确的 `web_search` 就绪状态，并约束：

1. 就绪时，开放式信息发现优先使用 `web_search`。
2. 未配置、未启用或请求失败时，如果真实浏览器仍能推进任务，先向用户说明正在切换到浏览器自动化，再读取 builtin `agent-browser` skill。
3. 不把 Agent Browser 描述成 `web_search`，也不静默安装外部 CLI。

这层只负责选择策略，不执行浏览器动作，也不在 `web_search` 内制造隐藏 fallback。

### 2. Builtin skill 负责 Agent Browser 生命周期

新增 `packages/nextclaw-core/src/features/agent/shared/skills/agent-browser/SKILL.md`，覆盖：

- `command -v`、版本和 `doctor` 检查；
- 缺失时说明外部依赖，经用户授权后再安装；
- 先读取 CLI 自带、与当前版本匹配的 `core` skill；
- 使用隔离 session 执行 open / snapshot / interact / verify；
- 对搜索引擎空结果、无关结果和验证码设置有界重试；
- 正常、失败路径都关闭本次 session；
- 登录、提交、上传、下载等副作用继续遵循用户授权边界。

不设置 `requires.bins`，否则 CLI 缺失时 skill 会被隐藏，Agent 反而无法执行首次安装引导。

### 3. 单一事实源与 Marketplace

`SkillsLoader` 已有 builtin 优先级：同名 workspace/global skill 会被 builtin 过滤。因此新增 builtin 后，旧的 `skills/agent-browser` 副本不会覆盖产品版本。

Marketplace 的 installed-record 也按 skill 名称匹配；builtin 生效后，远端同名条目会显示为已安装且不可重复卸载。远端目录内容和 `install_kind` 的发布同步属于 Marketplace 发布动作，不在本次本地源码交付中直接修改线上数据。

当前 Marketplace 公共查询只展示 `install_kind=marketplace` 的 skill，因此不能直接把线上条目改成 `builtin`，否则旧版客户端会失去安装入口。远端条目继续作为旧版兼容分发；新版执行时以 builtin 内容为唯一事实源。后续如同步远端说明或兼容副本，应保留这一查询合同，不能让 Marketplace 内容反向覆盖 builtin。

## 非目标

- 不把浏览器自动化包装成新的搜索 API。
- 不承诺浏览器搜索能绕过验证码或稳定替代搜索服务。
- 不把 Agent Browser 源码、npm 包或 Chromium 打进 NextClaw。
- 不在用户未知情时安装全局包、浏览器或执行有副作用的网页操作。

## 验收

- 未配置搜索服务时，Native prompt 明示 `web_search` 未就绪并提供独立浏览器路径。
- 配置有效 API key 时，prompt 明示当前 provider 已就绪。
- builtin skill 可由源码与构建产物加载，且覆盖同名 workspace 副本。
- skill 包含安装检查、版本匹配指南、真实浏览循环、搜索边界和 session 清理合同。
- 当前机器执行 `doctor`、已知页面访问和 Native Agent 对话冒烟通过；未知来源发现失败时能如实停止并完成清理。
