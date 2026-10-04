# Bibo 开源发布验收合同

- contract-id: bibo-open-source-2026-10-04
- parent-goal: 完成 Bibo 独立开源与发布，使外部开发者能够部署带真实 Linux 沙箱的个人 AI 工作空间。
- scope-revision: 1
- 用户来源：[原始输入](../../logs/2026-10-04-bibo-open-source/README.md)。开源、创建公共仓库、提交/推送、版本发布和必要验证部署已授权；没有授权社交发帖。
- 设计：[独立开源发布](../../designs/2026-10-04-bibo-独立开源发布.design.md)。

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| BIBO-01 | true | 独立公共 MIT 仓库含产品说明、安装、架构、成本口径、贡献入口与版本 Release | not-run | |
| BIBO-02 | true | 新 checkout 可冻结安装、类型检查、构建和打开完整 UI，不依赖原 monorepo 源码 | passed | 独立目录/public NPM 依赖，Node 22.23.2 frozen install、三包 tsc、181 项测试、Vite build、Worker dry-run 与浏览器回归通过；GitHub clean checkout CI 待发布复验 |
| BIBO-03 | true | 自部署账号登录、空间持久化及授权拒绝不依赖 NextClaw 托管账号，Secret 不进入客户端或仓库 | passed | 7 项认证用例与独立线上 Worker 登录、401/403、任务持久化、桌面/手机刷新；Secret 仅内存传入 Wrangler stdin |
| BIBO-04 | true | 公共 Harness 保留；普通聊天/文件路径不获取沙箱；真实 OS 执行能挂载同份 R2 数据并交付结果，沿用按需与空闲回收成本结构 | passed | 174 项 app 回归含 lazy acquisition；真实模型工具历史 mount_directory/exec/read_file/show_file，Linux Python 写入 R2 文件并网页刷新读回；普通聊天 tail acquisition=0 |
| BIBO-05 | true | hosted 认证不退化，无无关 WIP 混入；有效检查与 Review，通过后提交集成、发布和线上复验 | not-run | |

当前阶段门：design-review passed 后实现；所有 Required 有当前证据并完成复盘才关闭。未登记固定美元成本指标，因为用户未提供可复现账单条件；必须明确模型、Cloudflare 和沙箱费用，不作零成本承诺。无范围删减。
