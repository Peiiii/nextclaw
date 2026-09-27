# Bibo 文件展示事件与客户端合同

日期：2026-09-27。流程：standard，风险 L3；设计必需，独立 Plan 不必需，单批闭环。产品依据：[愿景](../VISION.md)。

## 来源、目标与用户链路

用户要求 Bibo 像 NextClaw 一样由 AI 直接打开右侧文件预览；明确要求 Client SDK 专门支持事件，完成后直接上线。初始本地主干落后于远程；本方案基于远程 master `4103aae8` 已有的个人空间、文件 API、右侧工作区和 Harness Contribution，替代此前“需要新建预览面板”的阶段性判断。

用户登录 app.bibo.bot，进入对话，要求保存并展示一份文档。AI 用已有 bibo file.create 保存，再调用 show_file；文字继续流式生成。回答与文件完成持久化后，网页自动打开既有右侧工作区，展示文件并保留聊天上下文。用户可以切换编辑、保存、关闭工作区，再从回复链接打开；手机使用已有工作区抽屉。刷新复用已有账号布局及文件 ID，不重放历史展示事件。

接入开发者使用 BiboClient.chat 的类型化事件回调获得 show-content，使用 BiboClient.readFile 获取经校验的文件详情，不需要解析 SSE 或泛型断言。SDK 不拥有网页导航或面板状态。

## 主链路与 owner

保留内核 show_file → ui.show-content；已有 BiboSpaceContribution 同步收集此事件，仅增加会话 ID，沿用原 target.payload.path/viewer，不做领域查找或异步映射。订阅由原 Contribution effect 生命周期释放，不新增 Contribution 或映射 owner。不增加模型工具或内核协议。

Runner 通过 SSE 发出 show-content，非流式结果携带 displayEvents。Worker 解析并暂存指令，仅在 commitSnapshot 成功后交付展示事件和 committed；取消、断连或保存失败不交付待提交指令。SDK 原协议 owner 统一校验事件和文件详情，拒绝畸形已知事件，继续忽略未知事件。网页 chat owner 等成功流结束后，把最后一个有效展示请求交给既有 WorkspaceResourceManager；校验账号、会话与当前视图，生产端按事件 ID 去重，复用既有请求竞态/关闭保护。文件读取与历史刷新复用已有 workspace API 串行队列，不另建调度或延迟 committed 状态。

个人空间文件及状态仍由 BiboSpaceService 持有；file.get 新增 path 精确读取，与 id 共用 fileDetail、路径及符号链接校验。仅允许个人空间中已登记文件；不会开放任意容器路径、配置或凭据读取。现有 file.create 产物与点击引用继续使用同一读取入口。个人空间里的绝对路径可用于 show_file，超出个人空间的路径显式失败。

## 取舍与不变量

直接在流中打开会与当前单操作容器锁及未提交内容冲突；采用保存后自动打开，无轮询、第二次模型调用或新在线资源。复制 NextClaw UI/服务端会产生第二套文件状态及权限 owner，因此复用已有工作区。保留 shared ui.show-content 语义和 Bibo SDK transport 合同；不新增泛化 event bus、连接管理器或任意文件服务。

公开闭集传播：内核生产 → Contribution 映射 → runner SSE/JSON → Worker parser/保存门 → SDK validator/类型/非流式分支 → chat owner → workspace manager/文件 API → 既有预览。展示请求不是持久业务数据，刷新布局由既有 store 拥有；既有会话 schema 不变。

## 验收合同 bibo-display-20260927（revision 1）

| ID | 必须成立 | 状态 | 证据 |
| --- | --- | --- | --- |
| BD1 | SDK 导出展示事件类型并验证 SSE/JSON 事件及 readFile 结果 | passed | SDK tsc、14 项测试、公共根导出检查通过 |
| BD2 | 真实 AI 保存文件并调用 show_file，保存成功后原会话右侧自动展示 | passed | 生产真实浏览器正常输入框调用模型，file.create → show_file → saving → show-content → committed；文件内容精确持久化，原会话自动预览 |
| BD3 | 取消/失败不打开未提交结果；账号、会话、路径、符号链接与畸形事件不越界 | passed | Worker 取消/保存失败测试；路径/符号链接测试；SDK 事件校验；Harness 去重与释放；已有关闭/迟到读取浏览器回归与调用方会话守卫通过 |
| BD4 | 桌面/手机打开、编辑、关闭、链接重开及刷新正常，既有发送/滚动/失败恢复不回退 | passed | 本地 display、resources、product smoke；生产 1365/390 浏览器自动预览、关闭、刷新与 Files 同对象读取，截图检查通过 |
| BD5 | 文档、代码 Review、Bibo Worker/Container 部署、生产冒烟及主线回流完成 | passed | 冻结远程 master 34a31c2e5 完整部署，Worker e99bbf27、Container b32bcfb2；文档 CI 36320609259 国内/全球及 verify 通过；主线已推送，本地原有 WIP 由 reconcile retry worker 保护并接管回流 |

验证矩阵：普通 Markdown/HTML，source/rendered；重复展示、缺失文件、目录、越界/符号链接、畸形事件；保存失败、取消、中断、切换账号/视图、关闭后迟到读取；刷新和旧会话。沿用既有安全 HTML/SVG 预览合同，不增加脚本执行权限。

方案 Review：按原用户需求核对完整链路、SDK 专属合同、保存门、生命周期和权限。占优方案有现有消费者，未留下无消费者抽象；no findings，design-review: passed。上线对象仅 Bibo 托管服务及其说明，不进行 NextClaw NPM/desktop 发布。

用户补充要求薄层、避免重复和冗余设计，已落实到应用 AGENTS；本设计据此取消新增展示 Contribution/独立解析文件，删除客户端分页查找文件，改为 SDK 精确 readFile。复核受影响部分：SDK 持有协议，现有领域 owner 持有权限，应用只收集、保存门及展示编排，design-review: passed。
