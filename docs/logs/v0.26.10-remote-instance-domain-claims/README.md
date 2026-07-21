# Remote 实例稳定身份与双固定域名

## 迭代完成说明

本次把 Remote 的实例身份与访问域名从“每次运行/打开产生新的技术标识”收敛为两个稳定产品事实：同一设备同一端口是同一个实例；每个实例自动保留一个系统随机域名，并可额外占用一个自定义域名。两个固定域名始终指向同一实例，分享链接仍使用可撤销的 session 域名。

根因由 connector、Gateway、数据库、平台 UI 和代理链路端到端确认：旧 connector 以数据目录中的随机 UUID 注册，换 `NEXTCLAW_HOME` 会新增实例；旧 owner Open 又把一次性 session ID 直接放进 `r-<session>.claw.cool`，所以列表和域名都会漂移。实现没有用 UI 合并掩盖数据问题，而是把 identity 归还 connector、把域名占用归还独立 claim 表。

最终行为如下：

- connector 使用不可逆设备指纹摘要与规范化服务端口生成 v2 identity；同设备同端口稳定，同设备不同端口隔离，原始机器标识不上传。
- Gateway 在可证明同账户归属且无冲突时，把旧随机 identity 原位升级为 v2 identity，保留实例 ID、归档状态和域名。
- `remote_instance_domains` 是系统域名与自定义域名的唯一 owner；`prefix` 主键负责跨两种 claim 的全局去重，`UNIQUE(instance_id, kind)` 保证每个实例最多各一条。
- 系统域名自动生成、不可修改、不可释放；自定义域名可设置、修改和主动释放，支持 `expires_at` 合同但暂不运行自动过期任务。
- `remote`、`r-*`、`i-*`、`nc-*` 等保留命名空间不可作为自定义域名领取。
- 平台实例列表同时展示“默认域名”和“自定义域名”；没有自定义域名时仍显示“设置域名”，Open 有自定义时优先使用自定义域名，否则使用默认域名。
- 分享继续使用 `r-<session>.claw.cool`，不把稳定 owner 入口混成公开分享地址。

详细 owner、迁移、兼容边界和验收标准见 [Remote 实例身份与双固定域名占用方案](../../designs/2026-07-20-remote-instance-identity-and-domain-claims.design.md)。

## 测试/验证/验收方式

- Gateway：`pnpm tsc`、`pnpm lint`、`pnpm build` 通过；`remote-instance-list`、`remote-instance-domain`、`remote-panel-app-session` 定向测试通过。域名测试覆盖系统/自定义双 claim、归一化、保留名、唯一性、过期回收、主动释放和新实例 `i-*` 系统域名。
- Remote 包：`pnpm tsc && pnpm lint && pnpm test:identity` 通过；验证跨 `NEXTCLAW_HOME` 的同设备同端口稳定、不同端口隔离和原始机器标识不泄露。
- 平台控制台：`pnpm tsc`、`pnpm lint`、`pnpm build` 与 `pnpm smoke:platform:console` 通过；覆盖默认/自定义双行展示、设置/修改/移除、冲突反馈、Open 选择顺序和桌面/移动布局。
- 真实本地链路：`pnpm smoke:remote-relay` 使用临时目录、真实 Wrangler/D1、真实 CLI connector 和两个本地 UI 端口通过；覆盖实例身份复用、不同端口分离、域名格式/保留/占用、owner session、分享撤销、移除自定义后默认域名保留及离线转换。
- 生产浏览器验收：在 `https://platform.nextclaw.io` 的真实登录态，为实例 `82bcca90-a43a-43c1-84d9-730a3dc1a9e5` 设置临时自定义域名，页面与远程 D1 同时显示 system/custom 两条 claim；自定义 hostname 成功建立并命中该实例的远程会话链路。
- 生产唯一性验收：释放后的临时名称可重新领取；另一个实例领取同名时，页面明确返回“这个域名前缀已被占用，请换一个。”；测试结束后再次释放，临时 custom claim 数为 `0`。
- 生产默认入口验收：移除自定义域名后，页面仍显示系统域名并通过该 hostname 创建新的 owner session。目标设备 connector 当时已离线，因此远端页面正确显示 `Remote device connector is offline`；域名解析、session 创建与 connector 在线状态已分别记录，不把离线误判为域名失败。
- 线上数据最终核对：86 个实例对应 86 个 system claim，缺少系统域名的实例为 `0`，重复 prefix 为 `0`，测试 custom claim 为 `0`。

真实验收发现并修复了一个仅在线上跨域环境暴露的缺口：初次部署的 Gateway CORS 未允许 `DELETE`，导致浏览器在请求到达 release controller 前报 `Failed to fetch`。修复后增加源码回归断言，并用生产 `OPTIONS` 验证 `access-control-allow-methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`，随后重新完成释放与默认入口验收。

## 发布/部署方式

- 远程 D1 已依次应用 `0013_remote_instance_identity_domains.sql` 与前向修正 migration `0014_remote_instance_domain_claims.sql`。
- Gateway 已部署到 `*.claw.cool/*` 和 `ai-gateway-api.nextclaw.io`；最终 Worker Version ID 为 `3d7b99be-8283-4dc4-ae46-5be22e947a91`。
- 平台控制台已部署到生产 `https://platform.nextclaw.io`；本批 Pages 预览为 `https://14b63c76.nextclaw-platform-console.pages.dev`。
- 本轮未执行 git commit/push，也未发布 `@nextclaw/remote` NPM 包。线上 Gateway 和平台已具备双域名能力；v2 connector identity 将在对应 NPM patch 发布后进入用户安装版。

## 用户/产品视角的验收步骤

1. 打开 [NextClaw Platform](https://platform.nextclaw.io)，在实例列表的“实例域名”列查看每个实例自动存在的默认域名。
2. 点击“设置域名”，输入可用前缀并保存；确认默认域名不消失，自定义域名作为第二条入口出现。
3. 点击“打开”，确认配置自定义域名时使用自定义 hostname；移除自定义域名后再次打开，确认改用原默认 hostname。
4. 在另一实例设置相同前缀，确认提示已被占用；输入 `remote`、`r-*`、`i-*` 或 `nc-*`，确认提示保留名称。
5. 移除自定义域名，确认该名称可再次领取，默认域名始终不变。

## 可维护性总结汇总

本次是新增用户能力，生产代码净增长用于稳定 identity 合同、数据库占用约束、API、双域名 UI 与真实链路测试。实现维持单一事实源：domain persistence 独立到 `remote-instance-domain.repository.ts`，注册只负责 base instance upsert 后确保 system claim，代理只从 claim 表解析 hostname，没有保留中间 `instanceDomainOpenUrl` 或第二套域名路径。

实现后已执行 maintainability guard、new-code governance、backlog ratchet 与第二轮人工 owner 复核。最终 guard 检查 83 个文件，统计为新增 5970 行、删除 2054 行、净增 3916 行；其中非测试新增 5110 行、删除 2003 行、净增 3107 行，结果为 `0 errors`、`7 warnings`。warning 集中在接近预算线的既有 Remote controller/repository/service、平台卡片和 smoke 文件，均已有明确拆分缝且未越过 hard budget。`packages/nextclaw/ui-dist` 存在并行工作产生的用户改动，本轮不擅自清理或覆盖。

## NPM 包发布记录

- `@nextclaw/remote`：需要 patch 发布，changeset 已添加，当前状态为 `待统一发布`。
- `@nextclaw/service`、`nextclaw`：作为直接依赖方已评估；统一发布时由 Changesets 的依赖传播结果决定是否随批次升级。
- 本轮部署的是 Gateway、D1 migration 和平台控制台，未执行 NPM publish。
