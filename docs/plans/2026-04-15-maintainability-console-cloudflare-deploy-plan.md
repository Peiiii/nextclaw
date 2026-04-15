# Maintainability Console Cloudflare Deploy Plan

## 目标

把 `apps/maintainability-console` 发布到 Cloudflare，形成“前后端同域、可公网访问”的可维护性 dashboard，同时明确线上版本不再尝试实时扫描部署机器文件系统，而是展示发布时生成的仓库快照。

## 方案结论

采用“Cloudflare Worker + Assets + 构建时快照”的一体式部署方案。

- 本地模式继续保留现有 Node/Hono 实时扫描能力。
- Cloudflare 模式新增 Worker 入口，负责：
  - 提供 `/health`
  - 提供 `/api/maintainability/overview`
  - 托管前端构建产物
  - 对非 API 路由做 `index.html` fallback
- 发布前新增快照生成脚本，直接调用现有 `MaintainabilityDataService` 生成 `source` / `repo-volume` 两份 overview JSON，并写入前端静态资源目录。

## 为什么不用“线上实时扫描”

- Cloudflare Worker 无法直接读取部署者本地仓库文件系统。
- 即使强行改成扫描 Worker 自身 bundle，也会得到失真的“部署产物视图”，不是项目真实仓库视图。
- 与其制造“看起来能刷新、其实不会重新扫描”的假实时，不如明确把线上版定义为“发布快照”，行为更可预测。

## 实现拆分

1. 数据契约新增运行模式字段，区分：
   - `live-scan`
   - `published-snapshot`
2. Node 服务入口与 Hono app controller 分离，避免本地启动逻辑和 Worker 入口耦合。
3. 新增 `build-worker-snapshots` 脚本：
   - 生成两份 overview JSON
   - 清理绝对本地路径等不该对外暴露的信息
4. 新增 `worker/index.ts` 与 `wrangler.toml`
5. 新增 app 级 deploy / remote smoke / worker typecheck
6. 根脚本补 `deploy:maintainability:console`

## 验证

- 本地：`lint / tsc / build / smoke`
- Worker 配置：`wrangler deploy --dry-run`
- 发布后：对 `workers.dev` 地址执行 `smoke:remote`

## 非目标

- 不做线上定时重新扫描
- 不做仓库 webhook 触发自动刷新
- 不做数据库存储历史快照
