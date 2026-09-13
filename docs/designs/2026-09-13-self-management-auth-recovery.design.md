# 开启认证后的自管理与升级恢复

## 用户链路与事实

用户在已登录的会话中要求更新并继续工作。Agent 执行标准 `nextclaw update`，按结果执行 `nextclaw restart`；连接短暂断开，实际新版本启动，原会话恢复并核对 `nextclaw status --json` 的运行版本。

2026-09-13 VPS 会话证明新版 CLI 的重启请求没有 Cookie，被正式 router 的认证中间件拒绝。过期的 managed 状态不是这次直接原因，foreground 状态记录着真实 PID。既有进程验收直接调用 controller，遗漏正式 router/auth。VPS systemd 还设置了禁用 bundle launcher 的历史环境覆盖。

## 冻结方案

复用 service 的 `UiBridgeApiClient` 与既有 `/api/auth/bridge`，不新增身份、凭据文件或认证豁免。重启与运行版本诊断使用同一个 client 的 HTTP response 入口，保留业务对 404、accepted 和版本的判定。client 在收到 401 后通过本地 bridge 获取 session 并至多重试一次；其它错误和超时不得降级为杀进程。Cookie 失效也只刷新一次。

向 bridge 发送磁盘密钥前限制为字面 loopback 地址，拒绝凭据 URL、非本地目标与重定向；请求共享同一取消信号。已有 bridge secret 文件收紧为 0600，兼容已有 secret 内容。关闭认证保持可用，公开 API 继续拒绝匿名控制。身份仍归 kernel AccessManager；service 只处理宿主传输。

不选择 401 后强制替换：它绕过计划重启准备，可能损失会话恢复；不新增本地 token owner：已有 bridge 能表达相同信任关系。不扩张到不相关的 CLI 或远程授权模型。

## 验收与交付

黄金验收：①认证开启的完整 router 上，CLI 重启触发实际进程替换并连续两轮续跑；②VPS 通过普通 CLI 重启后实际 bundle 版本正确、公开匿名控制仍拒绝；③真实模型会话触发重启后自动继续并报告运行版本。

自动测试覆盖认证开/关、错误密钥、401 后不杀进程、超时、非本地目标及重定向。进程验收把原裸 controller HTTP server 改为正式 createUiRouter，使用真实 AccessManager 与密码保护；保留确定性模型、签名更新源和两轮进程证据。

VPS 交付先备份当前 unit、运行产物和数据，从冻结远程 master 构建部署；迁移历史 launcher 禁用项，使 systemd 消费同一 bundle 入口。旧宿主首次切换采用明确的一次性维护迁移，随后必须以普通 CLI 证明不再依赖人工替换。保留可直接执行的回滚材料。不开启公网认证例外，不修改共存服务。

设计审查：既有 bridge 有完整身份 owner；重启与诊断是本次同一认证遗漏的两个消费者。新增 response 方法保留状态码语义，不创建第二传输实现。Required 标准见执行计划；设计 Review 通过后进入实现。
