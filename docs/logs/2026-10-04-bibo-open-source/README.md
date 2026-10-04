# Bibo 独立开源与发布

## 原始输入与约束

2026-10-04 用户先讨论 Bibo 开源前景，补充“我这个成本极低啊”“我这个有沙箱的，这个很重要”，随后明确“你来完成这个开源和发布”。核心叙事必须同时保留极低运行成本、真实 Linux 沙箱和完整个人工作空间。成本账单及具体负载没有提供，不编造数字。授权内 AI 决定：MIT 独立仓库 Peiiii/bibo、自部署单人账号与自带模型密钥；保留官方多账号托管链路。

## 迭代完成说明

已完成独立 MIT 开源、首版 GitHub Release、自部署真实沙箱验证及官方应用/官网部署。设计与有效验收见 [current-state](../../work/2026-10-04-bibo-open-source/current-state.md)。

## 测试/验证/验收方式

已通过源 app 三份 tsc、174 项 app 回归与 7 项认证测试、独立安装/tsc/build/Worker dry-run、桌面/窄屏产品回归。认证覆盖签名篡改、过期、密码轮换、注册关闭、限流入场与无平台依赖；DO 限流另验证跨实例持久、客户端隔离及分钟过期。

独立 Cloudflare Worker/R2 真实运行：普通模型回复、任务保存、Linux Python 计算前 20 个斐波那契数、挂载 R2 写入 Markdown、read_file/show_file 与会话持久化；桌面 1512×828 @2x 和手机 390px 登录、刷新、授权恢复通过。真实工具历史确认四类工具，截图见 `images/screenshots/bibo-sandbox-workspace.png`。普通聊天观察到零沙箱获取；OS tail 未观察到资源计数，以真实工具与保存文件作为 OS 证据，不报告虚构计数。

验证恢复：workers.dev 在当前网络 TLS reset，换到同一隔离 Worker 的测试域名完成验证；首次浏览器定位超时，第二次真实读取通过。未修改产品实现去掩盖环境问题，测试账号密码每次验证后即轮换撤销。

## 发布/部署方式

源提交 `2b913205dcf958d3d852106d665c16a7a01a4943`，独立初版提交 `448f1a73d0f4757e991160a8953c6dec3fcbfe46`。公共仓库 [Peiiii/bibo](https://github.com/Peiiii/bibo)；[v0.1.0 Release](https://github.com/Peiiii/bibo/releases/tag/v0.1.0) 含 tar.gz，SHA-256 `76c7563cd087705579f61a5a930e60edd22b5c8e0553cfa9fd32029da8ae4141` 与 GitHub 资产摘要相同。[GitHub CI](https://github.com/Peiiii/bibo/actions/runs/37186512628) 在 Ubuntu/Node 22.23.2 干净 checkout 上通过所有安装、类型、测试、构建、dry-run 步骤；标签 CI 同样通过。私密漏洞报告与 GitHub Secret 扫描保护启用。

冻结远程 master 部署官方应用 Worker/UI，入口 deploy:worker / containers-rollout=none；版本 `931661f3-b3d0-4925-b8fa-188cffe0fb88`。部署前后 bibo-hosted-sandbox 与旧 bibo-hosted-bibousercontainer 的 image、application ID、version 完全一致。官网只更新一个静态资源，版本 `c5022743-d2f9-4014-80d6-1129a33523c4`，1440px/390px 真浏览器开源链接、对话框和无横向溢出通过。

hosted 真浏览器验收 requestId=`bibo-live-fa288d52`：28 个增量、1 个文件展示事件，首个文件运行 12412ms；模型文件生成、自动预览、保存、桌面/手机刷新与异步问题均通过，合成测试文件/会话清理完成。旧脚本只认识 accepted 首帧、误把 /files 目录页当成具体文件；修正原脚本到 snapshot / files/<path>，未修改产品运行协议或页面去满足旧断言。

独立测试 Worker、沙箱容器、R2 bucket 与辅助清理 Worker 已删除。R2 使用的是 DO 命名空间路径，初次按 owner 路径删除未清空；后用仅绑定合成 bucket 的临时 Worker 删除 1 个对象并确认剩余 0 后删除 bucket，不触碰官方存储。

主区 WIP 与远程改动路径无重叠，保护性 ff-only 前后七份文件字节摘要相同；reconcile 已返回 LOCAL_MAINLINE_SYNCED。未使用 stash/reset/rebase。

AUTOMATION_INTERVENTIONS: 2。部署的 GitHub SSH 校验卡住，使用同一 deploy owner 入口临时 HTTPS Git URL 重写恢复；自动化消除落点是部署 preflight 的网络超时与重试 owner，本次不因一次环境故障扩大修改范围。主线脚本因任意 tracked WIP 保守拒绝快进；路径无交集和字节摘要验证后用保护性 ff-only 并重新运行 reconcile，消除落点是既有 mainline owner 的无重叠 WIP 判定，本次不改通用协调机制。

## 用户/产品视角的验收步骤

[开源安装与部署](https://github.com/Peiiii/bibo#readme) → 部署者自己的邮箱/密码私有登录 → 对话/任务/文件 → 请求 Linux 计算并保存产物 → 刷新读回。[官方体验](https://app.bibo.bot)使用原托管账号；自部署与官方数据独立。已具备验收条件，待用户确认体验偏好。

## 可维护性总结汇总

复用 Harness、领域动作 owner 与 Sandbox，导出公共依赖不复制内核。diff-only 维护性检查和全套新增代码治理通过，主观复核认证边界、单一状态 owner、导出 allowlist、依赖精确版本及 hosted 默认分支；没有未关闭 findings。自动检查对现有 app 测试文件 830/900 行给出预算接近 warning；新增 18 行限流回归仍在预算内，本次不扩大范围拆测试。导出器返回新 manifest，避免修改输入对象；没有新增部署框架或另一个 Agent loop。

## NPM 包发布记录

不涉及 NPM 包发布。独立版使用已有公共包的精确版本，两个未发布的 UI/client 包随源码 workspace 分发。
