# OpenCode Zen 免费模型开箱即用

## 迭代完成说明

- 对照 OpenCode 最新 `dev` 提交 `03bff6500abd09fc469d59e5bd4143d3eb053a94`、官方 Zen 文档、在线模型目录与真实网关调用，确认无账户凭据时使用公开身份 `public`，并只暴露零成本模型。
- 全新安装默认启用 `OpenCode Zen Free Trial`，默认模型与列表首项为 `opencode/big-pickle`。OpenCode 最新源码的内部模型优先级也明确包含 `big-pickle`，因此不是 NextClaw 自行臆测的推荐顺序。
- 当前交付七个真实可调用的免费试用模型：`big-pickle`、`deepseek-v4-flash-free`、`mimo-v2.5-free`、`laguna-s-2.1-free`、`longcat-2.0-free`、`north-mini-code-free`、`nemotron-3-ultra-free`。
- 在线目录仍列出 `ling-3.0-flash-free`，但真实请求返回“免费版本不可用”的 400；本轮以可调用性为准将它移出默认清单，并只从 OpenCode 类型配置中迁移删除该已知失效项，保留用户自定义模型。
- 匿名访问作为 provider 的显式合同由 Core/Runtime 描述，Kernel 统一解析有效凭据，Server 投影 `apiKeyRequired: false` 并用公开身份执行连接测试，Service 诊断识别匿名访问，UI 将其显示为“就绪”、隐藏无意义的 API Key 输入框并纳入模型选择器。
- 请求继续复用 `LlmProviderManager -> LiteLLMProvider -> OpenAICompatibleProvider` 单一主链路；没有新增第二套客户端、运行时网络探测或隐式 Responses API fallback。
- 只在配置文件不存在时写入 OpenCode 默认值；已有非 OpenCode 用户配置不被注入或覆盖。公共网关提示明确说明限额、模型变化和数据隐私边界。
- 官网中英文首屏、安装页、集成说明、SEO 元信息、README 与文档站首页、安装、快速开始、模型选择、provider 教程均已同步：新用户首先看到“无需 API Key 即可开始”，需要稳定配额、指定模型或敏感数据处理时再切换自己的 provider。

## 测试/验证/验收方式

- Core 定向测试 2 个文件、11 项通过；覆盖首次配置、持久化重载、已有配置不注入、损坏配置不覆盖、七模型目录、失效模型迁移、provider 注册与现有 LiteLLM 行为。
- Kernel provider 路由 5 项通过；Runtime provider 注册 3 项通过；Service 2 个文件、3 项通过（匿名诊断与首次配置初始化）；UI 模型目录与 provider 状态 2 个文件、3 项通过。
- Server 连接测试与 provider 元数据 2 个文件、9 项通过。仓库中的另一批未完成 stdio runtime 改动导致 Service、Server 的默认 Vitest 解析 `@stdio-runtime-client` 失败，本轮用临时 Vite alias 运行相同测试文件，未修改其源码或配置。
- Core、Runtime、Kernel、Service、Server、UI 的 TypeScript 检查全部通过；六个包的 lint 全部通过，只有既有复杂度警告、没有错误。
- 当前源码的 35 包完整构建闭包通过，随后以两个不同的空白临时 HOME 启动，日志均明确创建全新 `config.json`、workspace、memory、skills 和 panels；健康检查显示 NCP Agent 与 cron 均为 ready。
- 最终空白环境的 Provider API 返回 `apiKeyRequired: false`、`apiKeySet: false`、七个模型和 Chat wire API；真实 Provider 页面显示“就绪”、七个模型且没有 API Key 输入框。
- 最终空白环境的聊天页无需任何配置就默认选择 `OpenCode Zen Free Trial / big-pickle`，真实发送“只回复：FINAL_FRESH_INSTALL_OK”后得到精确回复 `FINAL_FRESH_INSTALL_OK`。
- 七个最终保留模型均已逐一通过 NextClaw 构建产物和 `LlmProviderManager` 主链路真实请求；默认模型工具调用与 `mimo-v2.5-free` 图片输入也通过。
- 官网补充改动通过 `@nextclaw/landing` 的 TypeScript、ESLint 与生产构建；ESLint 只有 `main.ts` 已存在的超长文件和超长 `render` 方法两条 warning，没有 error。文档站 VitePress 生产构建通过。
- 构建后的真实页面已在浏览器验收：`http://127.0.0.1:4173/en/` 可见英文开箱即用首屏与对应 SEO description，`http://127.0.0.1:4173/zh/install/` 可见中文无密钥安装说明；`http://127.0.0.1:4174/zh/`、`/zh/guide/getting-started.html` 与 `/en/guide/model-selection.html` 均显示目标文案和公共网关风险提示。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`git diff --check` 与 `pnpm release:summary -- --json` 通过；release summary 正确识别六个需要 patch 的包且无错误。

## 发布/部署方式

- 本轮以本地 Git 提交交付；未推送、未发布 NPM、未部署线上服务，也未重启用户当前运行的 NextClaw 实例。源码功能验收只启停独立端口和临时 HOME，官网与文档验收只启停本地预览端口。
- 已新增用户可读 changeset；`@nextclaw/core`、`@nextclaw/runtime`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/service`、`@nextclaw/ui` 后续随统一发布批次进行 patch 版本化，顶层依赖传播由 Changesets 合同处理。
- 不涉及数据库 migration、远程服务部署或 Desktop installer。OpenCode Zen 是外部公共网关，免费模型、限额和可用性可能由上游调整。
- 本次虽然有 UI 状态变化，但未产出放入 `images/screenshots/` 的稳定本地化发布素材，因此 changeset 不绑定版本配图；真实浏览器截图仅作为本轮验收证据。

## 用户/产品视角的验收步骤

1. 创建空目录并运行当前源码：

   ```bash
   NEXTCLAW_FRESH_HOME="$(mktemp -d /tmp/nextclaw-fresh.XXXXXX)"
   pnpm local:source-runtime -- start --home-mode temp --home-dir "$NEXTCLAW_FRESH_HOME" --port 18890 --instance opencode-fresh
   ```

2. 打开 `http://127.0.0.1:18890/providers`，确认 OpenCode Zen 显示“就绪”、没有 API Key 输入框，并看到七个免费模型。
3. 打开 `http://127.0.0.1:18890/chat`，确认默认模型为 `OpenCode Zen Free Trial / big-pickle`；输入“只回复：OK”，收到 `OK` 即证明全新安装开箱即用。
4. 验收结束后停止实例：

   ```bash
   pnpm local:source-runtime -- stop --home-mode temp --home-dir "$NEXTCLAW_FRESH_HOME" --port 18890 --instance opencode-fresh --no-build
   ```

5. 发送真实数据前阅读公共网关提示，不发送密码、密钥、商业机密或其他敏感内容；若免费模型限流或下线，可切换到自行配置的 provider。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review`。最终按本次交付范围检查 30 个相关源码/测试文件：0 error、10 warning；总计 `+758/-332`，净增 426 行；排除测试后 `+501/-330`，净增 171 行。全工作区守卫另有 1 个来自未提交 stdio runtime 并行改动的 error，不属于本次提交。
- 这是明确的新增用户能力，生产语义净增长适用功能交付口径。增长主要来自匿名访问合同、七模型事实源、前后端状态投影、失效模型迁移与回归测试，没有新增平行 provider 客户端或 fallback 链路。
- 正向减债动作包括：把 provider 类型与 registry 移到符合角色的目录/文件名；将 API Key 表单并入既有认证区；`provider-form.tsx` 相对基线减少 7 行；Server provider view 收敛为一次稳定对象构造，使 `server-config.store.ts` 相对基线减少 1 行。
- Provider Registry 触达后整类改为箭头函数，失效模型过滤改为纯输入输出函数；模块 alias、参数不变性和文件角色治理均通过。
- 保留的历史警告包括 Runtime 注册表接近预算、Server store 与 UI provider form 仍超长、若干目录已达文件数预算；本轮没有继续放大两个超长热点，下一步拆分缝已记录在红区条目中。
- 可维护性复核结论：通过；no maintainability findings。剩余警告均为未恶化的历史债务或已记录预算边界。

## 红区触达与减债记录

### packages/nextclaw-server/src/features/config/stores/server-config.store.ts

- 本次是否减债：是。
- 说明：匿名 provider 的密钥需求与连接测试继续由既有配置 store 投影；同时把 provider view 的 `wireApi` 条件赋值收敛为一次稳定对象构造，使该热点文件相对基线净减少 1 行，没有继续膨胀。
- 下一步拆分缝：按 provider 投影、连接测试与通用配置读写三个职责拆分独立 owner，优先迁出 provider 视图构建与探测逻辑。

### packages/nextclaw-runtime/src/providers/builtin.provider.ts

- 本次是否减债：是，OpenCode 的完整 provider 说明独立落到同角色文件，注册表只增加一个引用。
- 说明：文件由 510 行增至 512 行，仍低于 600 行预算但接近阈值；没有继续加入内联配置块。
- 下一步拆分缝：后续继续新增 provider 时，按网关、直连、本地等稳定类别拆出声明集合，由总注册表组合。

### packages/nextclaw-service/src/services/runtime

- 本次是否减债：未增加结构债务。
- 说明：目录保持 15 个直接文件不变，本轮只增强现有初始化测试，生产默认值仍由 Core 配置 owner 提供。
- 下一步拆分缝：按启动监督、更新分发、配置初始化三个职责折叠子 feature；不在本次 provider 集成中扩大范围。

## NPM 包发布记录

- `@nextclaw/core@0.15.18`：需要 patch，包含首次安装默认配置、七模型事实源、失效模型迁移与匿名访问合同；待统一发布。
- `@nextclaw/runtime@0.4.18`：需要 patch，包含 OpenCode Zen 内建 provider 元数据、公开身份与风险提示；待统一发布。
- `@nextclaw/kernel@0.6.20`：需要 patch，包含配置密钥优先、匿名凭据兜底的单一路由解析；待统一发布。
- `@nextclaw/server@0.15.20`：需要 patch，包含无密钥状态投影与连接测试；待统一发布。
- `@nextclaw/service@0.3.20`：需要 patch，包含匿名 provider 诊断状态；待统一发布。
- `@nextclaw/ui@0.15.21`：需要 patch，包含就绪状态、模型可选状态与无密钥表单；待统一发布。
- 顶层 `nextclaw` 的内部依赖传播在正式版本化时由 Changesets 评估；本轮未发布任何包。
