# 配置对象级 CLI

- contract-id：config-object-cli-20260908
- parent-goal：AI 通过对象级 CLI 完成供应商、模型和容易复用的相邻配置任务，不需要接触配置文件或内部字段路径。
- scope-revision：1；用户授权 provider/model 完整改造及容易完成的批量改造。
- 类型/风险：feature / L3；design-document: required；plan: not-required，同一实现批次以本文维护验收。

## 证据与方案

现有 CLI 只有通用 config 路径；server 已提供供应商 CRUD、模型目录/发现、连接测试、授权、默认模型与搜索 API。供应商写入由 server config store 校验、维护 SecretRef、保存，controller 发布更新并等待 live reload；CLI 可复用现有 LocalUiApiClient 的运行实例发现与 bridge 认证。

采用 CLI 参数 -> 现有本地 API -> 既有业务 owner -> 持久化/热更新 -> 脱敏结果这条链路。CLI 只翻译参数和显示结果，不复制 provider 默认值、模型归一化或搜索校验。不增加离线写配置分支；运行实例缺失时明确报错并提示启动。已有通用 config/gateway 工具保留，但引导降为未覆盖能力和显式恢复的过渡入口。

替代方案是 CLI 直接 load/save；它会复制 UI 的业务语义且丢失生效反馈，因此不采用。暂不迁移既有 server store 到 kernel，新入口消费既有边界，不借本任务重构整个配置 owner。

## 用户任务与命令

- `providers list|templates|show|add|update|remove|enable|disable`：模板发现、实例管理；API Key 可从指定环境变量读取，输出不含明文 Key 或请求头值。
- `providers models list|discover|set|configure`：查询、远端发现、明确替换配置模型列表、明确替换模型能力覆盖；配置覆盖支持 vision、thinking 支持级别及默认级别。发现不隐式保存，模型列表与能力覆盖分别操作，空列表/清除有明确动作。
- `providers test`：调用真实供应商测试，失败输出结果且退出码非零。
- `providers auth start|poll|import`：启动授权并显示 URI/code/session，按服务返回间隔轮询；拒绝/过期/错误非零，不自建等待循环。
- `models list|show|set`：查询目录、查询/设置默认模型，复用 UI 的模型语义。
- `search show|configure|provider`：当前搜索设置、默认供应商/启用供应商/结果数量、单供应商凭据与参数。只允许适用的供应商参数，避免后端静默忽略。

对象不存在、无修改参数、输入冲突或不合法在调用前/既有 API 边界明确失败。写入成功以 API 完成及后续 show 确认；真实第三方网络和 OAuth 需要相应凭据，本地受控服务验证端到端参数和状态，不冒充第三方实测。

## 批量改造判断

搜索与供应商复用相同 API 客户端和已有业务处理，纳入必需范围。渠道账号字段、渠道认证、路由绑定不具有相同简单边界，需要独立模型和更广验证，不属于用户所说“好做”的批量改造。现有 Agent、MCP、App 命令继续复用，无需重复建设。

## Active acceptance ledger

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| CLI-01 | true | Provider CRUD、启停、凭据、模型列表和能力覆盖可经 CLI 操作，保持无关字段 | passed | config-object-commands.test.ts；config-object-cli.integration.test.ts |
| CLI-02 | true | 模型发现、连接测试、默认模型设置及查询闭环 | passed | HTTP 集成测试；resolveProviderRuntime 消费应用后的配置 |
| CLI-03 | true | 授权启动/轮询/导入可调用，错误与等待状态可辨识 | passed | 定向测试覆盖 start/import 参数及 pending/authorized/denied/expired/error；未使用真实第三方 OAuth |
| CLI-04 | true | 搜索供应商及选项经对象级 CLI 配置并查询 | passed | 定向参数测试和真实 CLI/HTTP 保存及查询 |
| CLI-05 | true | CLI 复用现有 API，敏感值不输出，无服务明确失败 | passed | HTTP bridge 认证；脱敏断言；构建后 CLI 无运行实例时非零退出且不写 config 文件 |
| CLI-06 | true | 中英文命令全集、自管理指南/资源/skill、AI 上下文同步，旧工具保留但降为过渡路径 | passed | 命令全集 2 项测试；sync-usage-resource；skill progressive-loading |
| CLI-07 | true | 类型检查、定向行为与隔离运行链路验证、维护性 review 完成 | passed | nextclaw/core/kernel/server tsc；29 项测试；targeted ESLint；governance；maintainability 0 error |

## 阶段门

实现、验证与 Review 已完成。用户随后明确授权 commit、合入 master 和 push；NPM/桌面发布及线上部署未授权。主干集成与本地镜像同步的 Git 证据在最终交接记录核对，不操作用户运行配置或重启实例。

最终主观复核无未关闭 findings：CLI 仅承担参数翻译，模板来自 API 而非复制注册表；模型列表及覆盖以替换语义明确暴露；不增加配置保存、重试或离线分支。初检发现目录预算问题，命令和控制器已按责任归位。保留的两个维护性警告为既有 context provider 目录例外及 CLI 入口接近预算。

契约自审：不以命令数量替代完整任务，不要求真实用户密钥、不增加通用配置框架或新的离线兼容路径。未加入重复通用规则和与这批配置无关的产品能力。
