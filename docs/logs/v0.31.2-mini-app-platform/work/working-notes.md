# Mini App Platform 工作笔记

## 当前目标

完整交付组合包平台、四个初始应用、三轮优化、验证与发布部署。

## 当前事实

- 当前分支为 `master`，本迭代功能提交前基线为 `7179c7a18`。
- 当前源码产品版本仍为 `0.31.0`；changeset 计划稳定版本 `0.32.0`，版本写入将在隔离 release worktree 完成。
- 现有 `@nextclaw/app-runtime` 已有 schema v1 WASM NApp、`.napp`、registry 与本地生命周期。
- Panel/Service runtime 已成立，但只扫描 workspace 本地目录。
- Apps Registry 与公开 Apps Web 已存在，主产品 Marketplace 当前只支持 skill/mcp。
- 当前工作区存在其它任务对 marketplace skill 与 `v0.31.1` 记录的改动，本任务不触碰。
- `.napp` schema v2 已支持 Panel-only、Service-only、Panel + Service 组合包；v1 WASM 路径保持兼容。
- kernel 已建立包级 owner，并把启用组件投影到既有 Panel/Service runtime；组件代码与稳定数据目录已分离。
- 本地 server/client 已具备包列表、安装、启停、更新、回滚、卸载 API。
- 官方 `nextclaw.personal-organizer` 组合包已包含 Todo、Notes、Favorites、Calendar 四个 Panel 和一个共享 MCP Service。

## 关键约束 / 不变量

- 产品语义归 kernel；Panel/Service 继续各自拥有运行时事实。
- 不新增第二套包格式、市场或安装目录。
- 用户数据与不可变版本目录分离。
- community Service 开放前必须有可信安全边界。
- 发布部署已获用户明确授权，但仍按各发布合同执行真实验证。

## 证据 / 观察点

- 方案：`docs/designs/2026-08-12-mini-app-package-and-marketplace.design.md`。
- 目标：用户要求完整功能、四个初始应用、三轮优化并发布部署。
- `.napp` 当前已有校验和与版本目录，但解包前无预算、校验和未覆盖额外文件、目录替换与 registry 写入非事务。
- `PanelAppSourceService.resolveSourcePath()` 已能读取包外绝对路径，可作为受控投影底座。
- Panel/Service manager 当前所有枚举、授权和删除都默认 workspace source，必须显式区分 package source。
- Service runtime 当前只继承宿主环境；个人数据需要由宿主注入 `NEXTCLAW_APP_DATA_DIR`。
- Apps Web/Registry 已是真实公开域，主产品 Apps 页仍只有 workspace Panel/Service 管理。
- 仓库没有可复用的真实 Panel/Service 示例目录，四个官方应用需要按现有 manifest/bridge 合同新增。
- `@nextclaw/app-runtime` 已通过 11 个测试文件、26 项测试以及独立 `tsc`。
- app-runtime 当前测试已扩展为 11 个文件、33 项；触达严格 `contract-only` 旧根后，已把内部文件迁入标准 `controllers / services / types` 角色目录，公共导出和 CLI bin 保持不变。
- app-runtime 内部导入已切换为 Node 原生包级 `#app-runtime/*` imports，当前需要证明其在本包测试、kernel 与 server 源码消费三种环境下解析一致。
- `#app-runtime/*` 已在 app-runtime 本包、kernel source consumer、server source consumer 与构建后 CLI smoke 中验证通过。
- 完整包级验证矩阵、maintainability/new-code governance/backlog ratchet 均已通过；service 并行时序噪声已由定向与全量隔离复验证明。
- `release:stable --dry-run` 已识别 29 个发布包和 `nextclaw 0.31.0 -> 0.32.0`，结构化说明与 docs/website/X review 均 ready。
- kernel、server、client-sdk、service 与 nextclaw 包已分别通过 `tsc`；尚需在最终改动稳定后统一复验。

## 差距矩阵 / 交付顺序

1. app-runtime：v1 单体包 → v1/v2 判别联合；安全解包与原子 registry/install。
2. kernel：新增 AppPackageManager；向 Panel/Service 注入已启用组件，不复制到 workspace。
3. server/client：补包列表、启停、安装、更新、回滚、卸载 API。
4. UI：Apps 首页改成可发现/启用/打开/管理的包级体验，workspace 工具降为开发入口。
5. official package：四个 Panel + 一个 shared MCP Service，数据写入稳定 app data dir。
6. public marketplace：worker 独立验证 artifact，Web 展示 v2 组件与安装入口。

## 已排除项

- 合并 Panel/Service manifest。
- 安装时复制组件进 workspace。
- 新建独立 Mini App market/package/runtime。

## 关键决策

- 包格式使用 `.napp` schema v2 components。
- 内置四应用先作为一个官方组合包逐步完成。
- 包组件 id 在所有已启用包中必须唯一；与 workspace source 冲突时显式报错，不静默覆盖。
- package Panel 不允许走 Panel 删除；package Service 不允许走 Service 删除，生命周期统一回到包 owner。
- built-in 可随发行物提供并进入安装目录，但默认 disabled，不自动授权或启动 Service。

## 下一步

1. 精确 stage 并提交本迭代，排除 marketplace skill 与 v0.31.1 日志的其它 WIP。
2. 从功能提交创建隔离 release worktree，执行 0.32.0 version、strict check、publish 与 Git 闭环。
3. 完成 stable runtime channel、精确已发布安装/更新、线上文档与 X 公告验证。

## 剩余缺口 / 交接提醒

- 主产品 Apps 页面、公开 Registry/Web、四个官方 Panel 与真实一键安装链路已完成并经过浏览器验收。
- 三轮迭代已经完成；最终门禁发现三个结构硬问题，需按真实职责拆分后复验。
- 三个结构硬问题已经按安装源、Panel 包状态、Panel 条目呈现和日历订阅职责完成拆分；diff-only maintainability guard 已达到 0 error。
- 官方 `0.1.0` 发布后本地仍有等价实现清理，最终应升级并发布 `0.1.1`，避免源码与线上 artifact 不一致。
- 尚需完成隔离冷启动、changeset、精确提交、NPM/GitHub/产品发布与发布后线上冒烟。
- 实际产品发布版本与 package 组合由发布合同在最终收口阶段确定，当前目标记录以 `v0.31.2` 组织。
