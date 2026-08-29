# Capability Provider 与资源绑定纵向闭环实施计划

状态：已实现，进入最终验证与交付。

## 目标

在不新增第二套 App/扩展平台的前提下，让独立分发的 Service Provider App 能满足另一个 Portable App 声明的 capability/resource 依赖，并让 API、CLI 与 Agent 通过同一 Kernel owner 完成检查、绑定、验证和解绑。

## 范围与不变量

- Provider 仍是普通 schema v2 `.napp`，使用现有安装、签名、启停、版本和卸载链路。
- Provider Service 通过 manifest 声明稳定 capability id/API version、可满足的 resource type；Consumer 使用现有 `requires` 声明。
- binding 只写入 Consumer instance 的 `config/dependencies.json`，保存 provider service id 等非敏感引用；Secret、token、密码和连接串不得进入 binding 或公开包。
- Provider 的真实外部服务配置通过其 Service Actions 完成，继续使用现有 Agent Action 授权；用户只处理不可代理的登录、授权或付费确认。
- 缺 Provider 或 binding 时保持可安装但不可启用；不静默 fallback，不自动选择多个候选中的任意一个。
- 组件调用仍走 runner 的 `allowedProviderIds`；resolved binding 只扩充对应 Consumer component 的允许列表，不开放任意跨组件调用。

## 实施切片

1. 扩展 Service manifest：Provider 声明 `provides.capabilities`，解析器校验 id/version/resource types。
2. 新增 `AppPackageDependencyService`：原子读写 instance binding、解析 available Provider、生成 readiness 与每个 Component 的 resolved provider ids。
3. 复用 `AppPackageManager` 暴露 inspect/setup/bind/verify/unbind；setup 只在候选唯一时自动绑定，多候选或缺失时返回结构化待处理状态。
4. `ServiceAppManager` 投影已启用并运行的 Provider catalog；App runtime hooks 把它交给 AppPackage owner。
5. `AppPackageComponentSource` 携带 resolved provider ids；Service record 合并 manifest 静态 provider 和 binding provider，runner 合同不变。
6. 在既有 App Package HTTP/CLI 下增加同一组命令；Agent tool 复用同一 Kernel 方法，不另建状态 owner。
7. 用两个临时真实 `.napp` artifact 验证：Provider 独立安装/启用，Consumer 从 needs-capability 到自动绑定、ready、enable、跨包 component-call，再 unbind 回到 needs-configuration。

## 快速验证漏斗

1. manifest parser 与 binding store 单测；
2. AppPackageManager readiness/bind 定向测试；
3. Service record 动态 provider allowlist 测试；
4. API、CLI、Agent tool 合同测试；
5. 本机真实 HTTP + 两个 artifact + runner 跨包调用；
6. 稳定后仅一次跨平台最终矩阵。

## 明确不做

- 不把 Redis/PostgreSQL 客户端编进默认 runner；
- 不创建任意动态进程内 Spin Factor ABI；
- 不在 binding 中保存明文 Secret；
- 不为本切片建设完整 Marketplace 推荐/评分系统；
- 不要求普通用户执行 shell、编辑 JSON 或理解端口/TLS。
