# Bibo 文件展示事件与薄层原则

## 迭代完成说明

状态：开发验证与代码审查完成，待集成与部署。用户要求 AI 像 NextClaw 一样直接打开右侧文件预览、Client SDK 专门支持事件、完成后直接上线；补充要求 Bibo 保持薄层并将原则落地。

缺口由端到端源码确认：内核已有 show_file 与展示事件，Bibo 已有文件存储、文件读取和侧栏；缺少事件穿过 Runner、保存门、SDK 到工作区的连接。早期本地 master 落后，已改用远程基线，未重复建设预览组件。设计与验收账本见[本批设计](../../designs/2026-09-27-bibo-display-events.design.md)。

复用已有 Contribution、领域文件 owner、协议解析器和工作区管理器。保存成功才交付展示请求；SDK 提供类型化事件与 readFile 精确读取，删除客户端分页查找。薄层原则写入 apps/bibo-hosted/AGENTS.md。路径安全和文件状态继续归领域 owner。

## 测试/验证/验收方式

- Bibo Worker、网页、Runner 与 Client SDK 的 tsc 通过；SDK 14 项、Bibo 45 项测试通过，包括取消后丢弃展示请求。
- 标准 Harness 原生展示事件的去重和订阅释放、Worker 持久化失败门、Runner 跨会话事件、路径与符号链接拒绝均有定向证据。
- 桌面与手机真实浏览器本地验收通过：自动预览、源码、关闭/链接重开、刷新、保存失败、桌面预览 DOM 保持与手机关闭意图；已有 workspace-resources 和 product smoke 通过。
- 技能渐进加载、目录/owner 治理与 backlog ratchet 通过；定向 ESLint 通过。生产真实模型验证待部署。

## 发布/部署方式

按用户明确授权，审查后集成远程 master，从干净冻结主线执行 Bibo deploy，检查 Worker 和 Container 身份，再运行专用账号的 live smoke。中英文用户文档随主线交给既有 docs-deploy workflow；本服务帮助页随 Worker 资产部署。持久状态 schema 不变，无新增 migration、NPM 或桌面发布。

## 用户/产品视角的验收步骤

登录 https://app.bibo.bot/，在对话输入“创建一份报告，并在右侧预览”。保存完成后工作区自动打开文件，可预览或编辑，关闭后从回复链接重开。手机关闭工作区返回对话；刷新读取已保存文件。停止生成或保存失败不自动展示本轮产物。

## 可维护性总结汇总

协议校验归 SDK，权限和文件状态归已有 BiboSpaceService，应用仅桥接事件和连接已有侧栏。未增加展示 bus、预览服务、轮询或在线资源。原有分页文件查找已删除。规则新增仅落在 Bibo 应用 owner，不扩大到全仓库。新增文件通过 planned-path preflight。

维护性检查零 error、四项预算 warning。按已有文件状态 helper 承接纯打开状态计算，并将两次相邻状态更新合为一次；Runner SSE 与 JSON 结果共用同一解析入口。脚本按工作区职责归入子目录，未加业务层。主观复核确认必要权限与状态保护由原 owner 负责，无多余抽象；app 目录告警仅新增标准框架边界测试，其余为原 owner 接近预算，未扩大生产职责。Review：no findings。

## NPM 包发布记录

不涉及 NPM 包发布。Bibo app 与 SDK 均为 private workspace package，用户可见变化已有两包 patch changeset，版本记录交给后续统一版本批次。
