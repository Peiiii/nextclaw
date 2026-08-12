# v0.33.0 可规模化应用市场

本迭代把 v0.32.0 的可安装 Mini App 链路推进为可以承载大量应用的市场，并修复用户实际遇到的应用图标/封面缺失、版本切换无反馈、无法卸载、分类布局跳动、弹窗比例不合理与安装阻塞等问题。

## 根因与方案

- 原目录接口一次返回完整应用列表，查询依赖 `COUNT`、`OFFSET` 和模糊匹配；客户端也把整份目录当成本地筛选数据。规模增长后，网络、数据库和浏览器三端都会线性变慢。
- 安装、更新、回滚与卸载的操作状态由当前弹窗局部持有；视图关闭后用户失去进度，失败也缺少统一恢复入口。
- 应用视觉资产虽然存在于源码，但没有进入 Registry 的发布与分发合同；客户端只能显示通用图标或损坏图片。
- Apps 不同页面各自拼装卡片、标签和操作菜单，导致相同事实出现多套表现与交互。

本轮以 Registry 分页查询为唯一目录主链路，以 kernel operation manager 为应用生命周期状态 owner，以应用包视觉清单为图标和封面 owner；产品内 Apps 和公开网站分别消费同一份 Registry 事实。

## 交付结果

- Registry v2 支持游标分页、服务端搜索、标签过滤、ETag/304、公共缓存和不可变静态资产；保留 v1 兼容接口供旧客户端与渐进部署使用。
- D1 增加应用检索索引、FTS 与标签同步触发器；10 万应用规模下完成查询计划、分页和写入一致性验证。
- 应用视觉资产进入发布包与 Registry 文件存储，官方 Personal Space、Hello Notes、Workspace Glance 和 Starter Card 补齐图标与封面。
- 发布器会把 manifest 声明的图标与市场封面一起写入 Registry 文件存储，避免目录生成了图标地址但资源不存在。
- 为遵守 Registry 的不可变版本合同，视觉版第一次发布后没有原地覆盖：补齐发布器的 icon 文件合同后，Personal Space 以 `0.1.3`、另外三款官方示例应用以 `0.1.2` 作为最终版本发布；中间修订和旧版本均原样保留。
- 产品内添加应用改为按页加载的响应式市场；分类控件稳定、卡片比例统一、错误与空状态明确。
- 安装、更新、回滚与卸载都由统一后台 operation manager 持有，可跨弹窗和视图观察进度、结果与失败恢复。
- 内置应用允许卸载并重新安装；应用数据继续位于稳定目录，不随包卸载被隐式删除。
- 公开 Apps 网站完成信息架构、卡片、详情、筛选和响应式视觉重构，直接消费可缓存的 Registry 目录与资产。

## 验证记录

| 范围 | 结果 |
| --- | --- |
| Marketplace Worker | 12 个测试文件、29 个测试；tsc、lint、build 通过 |
| UI | 4 个定向测试文件、18 个测试；tsc、targeted lint 通过 |
| app-runtime | 11 个测试文件、37 个测试；tsc 通过 |
| kernel | 1 个定向测试文件、5 个测试；tsc 通过 |
| server | 1 个定向测试文件、2 个测试；tsc 通过 |
| client-sdk | 2 个测试文件、21 个测试；tsc 通过 |
| Apps Web | tsc、lint、production build 通过 |
| 规模验证 | 本地 D1 10 万应用：查询计划、游标、FTS/标签触发器增删改、缓存、ETag/304、静态资产 Range/HEAD 通过 |
| 真实界面 | 1440×900 主产品：三类标签宽度稳定，弹窗 772×665 无溢出，三款应用图标与封面正常，版本菜单和卸载入口存在 |
| 生产网站 | `apps.nextclaw.io/apps` 真实浏览器复验：目录与 6 个可见视觉资源全部 200 且解码完成，console 0 error/warning/issue；Lighthouse Accessibility、Best Practices、SEO、Agentic Browsing 均为 100 |
| 可维护性 | diff-only maintainability 0 error；Worker 公共缓存职责与 UI marketplace service/types 已拆分 |

上述“通过”只覆盖已经执行的自动化与真实浏览器证据；纯视觉取舍仍由用户在生产界面做最终偏好确认。

## 发布记录

- Registry 已应用 `0011_app_marketplace_visuals_20260812.sql` 与 `0012_scalable_app_catalog_20260813.sql` 两个远端 D1 migration，并部署 Worker `070bfb5e-b289-4edd-b03e-91dd11d1da80`；`marketplace-api.nextclaw.io` 与 `apps-registry.nextclaw.io` 的 v1/v2 公共入口均返回 200，ETag/304、缓存与不可变资产探测通过。
- 四款官方应用已按不可变版本合同发布：Personal Space `0.1.3`，Hello Notes、Workspace Glance 与 Starter Card `0.1.2`；四组 icon/cover 公共地址均返回正确媒体类型，Registry 记录包含对应 SHA-256。
- Apps Web 已部署到 Cloudflare Pages 生产环境，最终部署为 `https://3c7484b9.nextclaw-apps.pages.dev`，自定义域 `https://apps.nextclaw.io` 已切换到同一构建；同时补齐搜索框语义、标题层级、文字对比度、`robots.txt` 与 `llms.txt` 后完成真实浏览器复验。
- `nextclaw@0.33.0` 与同批 27 个 `@nextclaw/*` 包已发布到 NPM，`nextclaw@latest` 已反查为 `0.33.0`；功能提交为 `efb52a723`，发布提交与 `nextclaw@0.33.0` tag 均为 `b80ab2115`，已推送 `origin/master`。
- GitHub Release 为 `https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.33.0`；darwin arm64/x64、linux x64、win32 x64 四个 runtime bundle 均带 GitHub SHA-256，由 `https://github.com/Peiiii/nextclaw/actions/runs/31636763034` 构建并发布 stable channel，全部作业成功。
- 四个平台公开 stable manifest 均返回 `latestVersion: 0.33.0`、`minimumLauncherVersion: 0.18.11` 与本版本说明地址；稳定版发布脚本的 NPM 包 tsc/lint/build 检查点全部通过，公网冷安装/更新验证完成。
- 中英文版本说明与结构化 release JSON 已在 `docs.nextclaw.io` 返回 200。
- X 公告未发布：旧客户端与刷新协议后的 `bird 0.9.0` 均被 X 以自动化风控错误 226 拒绝，且没有返回帖子 ID；后续检索也没有发现该正文。按照“写入后必须回读、禁止盲目重发”的合同，本轮停止重复尝试，因此不存在重复帖子。

## 风险与边界

- 目录服务的规模验证证明了查询与分发结构，不等同于真实流量下的容量结论；上线后仍需观察缓存命中、查询延迟和错误率。
- v1 fallback 只用于 Registry 渐进升级与旧客户端兼容，不承担未来大目录的主链路。
- 本轮不改变 community Service 的信任边界；可执行 Service 的审核与系统级隔离仍是独立后续能力。

关联文档：

- [方案设计](../../designs/2026-08-13-scalable-app-marketplace.design.md)
- [体验优化计划](../../plans/2026-08-12-app-marketplace-experience-polish.plan.md)
