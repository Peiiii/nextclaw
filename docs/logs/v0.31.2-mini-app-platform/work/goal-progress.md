# Mini App Platform 目标进度

## 当前目标

一次性交付 Mini App 组合包与市场闭环、Todo/Notes/Calendar/Favorites 四个初始应用，完成三轮产品优化、充分验证、提交、发布和部署。

## 验收条件

- Panel-only、Service-only、Panel + Service 包可检查、打包、安装、更新、回滚、禁用和卸载。
- 已安装包能投影到真实 Panel/Service runtime，代码版本不可变、个人数据跨版本稳定。
- Marketplace 与 Apps 入口能发现、安装、打开、授权、管理和恢复应用。
- Todo、Notes、Favorites、Calendar 均可真实使用，并遵守各自已冻结的轻量边界。
- 三轮迭代均基于实际运行证据改进功能、体验和视觉。
- 定向测试、类型检查、lint、真实端到端、构建/发布合同与线上冒烟全部通过。
- 精确提交并完成适用的 NPM、Cloudflare、GitHub 与产品发布闭环。

## 非目标

- 第一阶段不开放 community Service 任意本地代码。
- 第一阶段不实现普通聊天 Agent 直接读写个人信息 Service。
- 不把笔记做成复杂块编辑器，不把收藏做成知识图谱，不把日历替代为 Cron。

## 冻结边界

- 复用现有 `.napp`、Apps Registry、Panel App 与 Service App runtime。
- 包级管理、Panel 级启动；多 Panel 包声明主 Panel。
- builtin 默认 available，用户主动启用；安装确认与 runtime grant 分离。
- 保留工作区内其它任务的改动，不覆盖、不混入。

## 已完成进展

- 完成并复审 Mini App 组合包与 Marketplace 方案设计。
- 建立本目标契约与跨轮工作笔记。
- 完成 app-runtime、kernel、server、UI、Apps Registry/Web、示例与发布链路审计。
- 冻结组合包投影边界：包归 AppPackageManager，运行事实仍归 Panel/Service manager。
- 完成 `.napp` schema v2、组合组件校验、解包预算、完整校验和、原子 registry/install、启停与版本回滚合同。
- 完成 AppPackageManager、Panel/Service runtime 投影、稳定数据目录注入，以及 server/client 包生命周期 API。
- 完成 Todo、Notes、Favorites、Calendar 四个 Panel 与共享 Service 的首版官方组合包。
- `@nextclaw/app-runtime` 定向测试 26 项通过；app-runtime、kernel、server、client-sdk、service、nextclaw 类型检查通过。
- 完成第一轮纵向功能迭代：真实官方包已跑通安装、启用、Panel/Service 投影、授权调用与稳定数据目录。
- 完成第二轮体验与视觉迭代：主 Apps 入口、包级管理、四应用直达、权限确认、空状态与窄面板适配均通过真实浏览器验证。
- Todo、Notes、Favorites、Calendar 已分别完成真实创建、读取与删除；测试数据已清理，并留存对应浏览器截图证据。
- 为应用清单补充中英文展示字段，并在主产品按当前语言解析包与组件元数据。
- 完成第三轮可靠性、安全性与性能优化：覆盖引擎版本兼容、安装/卸载事务、同进程注册表并发、授权残留清理、个人数据原子写入、笔记路径边界与日历订阅 SSRF 防护。
- 完成官方组合包发布，公共 Apps Registry 已提供 `nextclaw.personal-organizer@0.1.0`，线上下载校验和、详情页与隔离安装均已验证。
- 完成主产品从公共 Registry 安装、启用并投影四个 Panel 与一个 Service 的真实链路，跨卸载/重装的个人数据逐文件校验和保持一致。
- 补齐主产品内 Marketplace 发现、搜索、详情、已安装识别与一键安装入口，并在 420px 窄面板完成真实视觉与交互验收。
- 修复已发布 bundle v1 的兼容回归，并为公共 Registry 幂等 GET 增加有界瞬时重试和远程 bundle 下载预算。
- 完成 app-runtime、kernel、server、client-sdk、service、UI、worker 与 nextclaw 的最终测试、类型检查、lint、build、真实浏览器和治理门禁。
- 完成 `nextclaw@0.32.0` 与同批 27 个包的 NPM stable 发布、Git 标签、GitHub Release、四平台 stable runtime channel 和从 0.31.0 的真实更新验证。
- 完成发布分支向 `master` 的 fast-forward 回流，双域名文档及结构化说明上线，Apps Registry/Worker 线上复验和 X 公告回读。

## 当前下一步

验收条件已全部满足，发布证据已留存，master CI 与工作区范围审计通过；目标完成。

## 计数器

20/20（完成）
