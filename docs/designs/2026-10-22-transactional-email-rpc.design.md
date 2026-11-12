# 跨产品事务邮件传输

## 目标与授权

Bibo 已独立，用户要求分离账号并无感迁移旧用户，同时明确要求复用 NextClaw 的现有邮件服务，由 AI 全权处理。身份、验证码与会话留在 Bibo；NextClaw 仅提供邮件传输。现有 Resend Secret 只保留在 provider-gateway-api Worker，不复制或回显。

## 方案

- 抽出既有 Resend 请求为纯传输工具，原 NextClaw 注册/重置邮件沿同一入口调用，模板、收件人和错误合同不变。
- 添加 Cloudflare WorkerEntrypoint `TransactionalEmail` 的私有 `fetch /send` 接口，供同一账户显式绑定的 Bibo Worker 调用。没有 HTTP 邮件发送路由，不接受匿名网页调用；Cloudflare Service Binding 是调用能力边界。
- 采用命名 Service Binding 的标准 fetch override（不新增公网路由）；输入为收件邮箱、主题、纯文本、HTML及可选显示名；发信地址只能来自原有环境变量中已验证的地址，Bibo 仅将显示名设为 Bibo。验证长度和格式，拒绝 CRLF/自选发信域。模板、验证码生成与验证、账号事实均归调用产品。
- 拒绝复制密钥、新建第二套账号代理或公开 mail relay。沿用 Cloudflare/Resend，无新产品依赖。RPC 类只承载可信服务边界，原 HTTP Handler 不导入 WorkerEntrypoint，保持 Node 测试可运行。
- 失败返回固定传输错误，不把密钥、验证码正文或供应商原始响应写日志。Bibo 自己处理发送失败与验证码生命周期。

## 验证与发布

原平台邮件调用前后 payload相同；provider fetch fixture 验证地址、显示名、正文与错误；tsc、targeted lint、Worker dry-run、diff maintainability与治理检查。RPC用真实Worker Service Binding验证可调用，公共HTTP路径无法调用。发布只更新独立网关 Worker，不发布 NextClaw NPM/桌面/文档站。保留原账户DB/路由/Secret/DO/定时配置，冻结远程master发布；记录前后version与回退入口。

## 方案 Review

mode=design，按用户“复用NextClaw”和“账号分开”对账；唯一凭据owner、能力受限RPC、模板/身份归调用方，原平台行为不变。具体传输采用标准fetch override，符合WorkerEntrypoint与现有类方法治理合同，方案复审通过。无未关闭finding，design-review: passed。目标文件已通过planned-path preflight。App管理worktree从origin/master=802b1fe创建，首次编辑前干净；NextClaw源工作区七个WIP未改。bootstrap复用原项目Node校验及精确Node wrapper；offline缺少tarball后仅在线获取网关与根治理工具依赖，未链接其它checkout的node_modules。
