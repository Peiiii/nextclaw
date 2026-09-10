# 工作台视图统一实施与验收

- active-contract / contract-id: unified-workbench-views-20260911
- parent-goal: 完整梳理并落地现有会话、会话工作台与全局右侧内容的统一视图模型、操作语义和交互风格，交付用户验收。
- scope-revision: 5；scope-confirmation: 用户原始授权。
- 设计：[统一方案](../designs/2026-09-11-unified-workbench-views.design.md)。
- 工作区：`/Users/peiwang/Projects/nextbot-unified-workbench-views`，`codex/unified-workbench-views`，基线 `c7c001942`。
- 授权：实现、验证、本地运行验收；后续用户已授权 commit、合入主干并 push；无发布授权。单代理。

## 阶段图

| 阶段 | 交付结果 | 门 | 状态 |
| --- | --- | --- | --- |
| 调查/设计 | 完整链路、模型、交互合同 | design-review passed | completed |
| 公共外壳 | 统一 manager、状态和操作组件 | 状态迁移及 DOM 身份检查 | completed |
| 接入与跨位置 | 三类现有容器、会话/文件入口统一 | 原业务主路径与上下文保持 | completed |
| 验证与交付 | 实际 UI、文档、Review 与验收入口 | 所有 Required current passed | completed |

## Active acceptance ledger

| ID | Required | 合同 | Status | 当前证据 | 失效原因 |
| --- | --- | --- | --- | --- | --- |
| WV-01 | true | 统一模型、状态 owner、能力边界、交互合同与实施方案完整 | passed | design 与方案 Review | — |
| WV-02 | true | 三类容器共用移动/缩放/收起/最大化及恢复状态机和皮肤 | passed | WorkbenchSurface 状态机/交互测试及真实 Panel App 停靠→浮动→最大化；125 项定向测试通过 | — |
| WV-03 | true | 模式转换和收起保留内容实例；不会误取消任务/丢草稿 | passed | 浮动会话 textarea 与共享外壳 DOM 保留测试；真实 iframe 模式切换计数为 1 | — |
| WV-04 | true | 会话与文件在适用位置有一致入口，文件保留来源上下文 | passed | workspace-file URI/快照/源视图测试、工作台菜单及资源 manager 测试通过 | — |
| WV-05 | true | 拖动/缩放边界、窄屏、键盘、焦点及动作语义可预测 | not-run | — | — |
| WV-06 | true | 全局资源、工作台导航、标签、固定入口和刷新恢复无回归 | passed | chat-thread store/manager、DocBrowser 标签/历史和页面固定测试通过 | — |
| WV-07 | true | 中英文用户说明、类型检查、构建、Review 和真实 UI 验证完成 | not-run | — | — |
| WV-08 | true | 本地可用验收入口和最短验收步骤已交付，主观项披露 | not-run | — | — |
| WV-09 | true | 资源/视图/路由身份驱动统一滚动恢复，延迟加载及用户接管正确，刷新/重开记忆有界 | passed | navigation-history、DOM 与 Panel App 恢复测试；新增存储拒绝/配额保护测试通过 | — |
| WV-10 | true | 全局及工作台共享历史算法，后退/前进/分叉/失效项一致，URL 各自阅读位置保留 | passed | 共享历史回退/前进/分叉与 DocBrowser/工作台测试通过 | — |

| WV-11 | true | 左侧页面固定区支持应用之外的页面，URI 去重并保留现有应用偏好 | passed | 5 项页面侧栏测试；真实非应用 Skills 固定与取消固定恢复原列表 | — |
| WV-12 | true | 同一页面跨位置消费同一完整动作协议，含添加到聊天、复制 URI 与位置操作 | passed | 共享资源动作、工作台文件操作、全局标签及会话菜单定向测试通过 | — |
| WV-13 | true | 页面 URI 可在适用主区/侧栏/浮层重建，引用保留正确资源上下文 | not-run | 资源 manager 与 workspace-file 路由测试；Panel App 主区/侧栏真实打开 | 新增系统对象与 Skill 覆盖须重验 |

| WV-14 | true | Markdown 会话及其他资源 URI 链接沿统一打开策略跳转，不绑定临时容器且保留安全边界 | not-run | 真实 Markdown 渲染器+拦截器集成测试验证普通 app 链接、优先复用；非法 scheme 被拒绝 | 新增系统对象与 Skill 覆盖须重验 |

| WV-15 | true | 资源专属图标→类型图标→通用图标统一降级，Markdown/标签/侧栏使用同一身份 | not-run | 共享图标 fallback 测试与 Markdown 图标测试；真实导航与标签正常渲染 | 新增系统对象与 Skill 覆盖须重验 |

| WV-16 | true | AI 稳定上下文感知资源协议，添加到聊天元数据注入与普通 Markdown URI 输出往返完整 | not-run | 用户新增，已完成补充设计 Review | 新增系统对象与 Skill 覆盖须重验 |
| WV-17 | true | NextClaw 资源协议名称和资源/视图/容器术语在方案、用户说明及 AI 合同一致 | passed | 设计、双语用户文档、kernel 稳定 AI 输出合同使用同一正式名称；上下文测试通过 | — |

| WV-18 | true | 系统对象、单个 Skill、本地文件与现有集合 URI 覆盖矩阵完成，真实报错链接可打开或明确资源级失效原因 | not-run | 用户真实验收发现对象路由缺口，已补设计 | — |

## 当前阶段门与恢复入口

当前实现、Validation 与 Review 已完成；资源协议、左侧固定区、Markdown 与 AI 上下文补充已完成真实运行验证。各阶段沿相同 ID 更新证据，不缩减最终目标。新模型分叉先更新设计并 Review。压缩后先读此 ledger，再核对工作区 diff。

必须不发生：覆盖其他 WIP、关闭即取消会话、相对文件路径随主会话漂移、模式切换丢失内容实例、主观美观代替行为验收。

契约 Review：剔除无关的任意布局树、所有设置页面面板化和新插件系统标准；用户明确讨论当前三类容器，这些扩展没有当前消费者。视觉偏好留给用户，正常渲染和交互必须由 AI 证明。

## 交付状态

Required 条目已按当前证据关闭。预览与客观验证完成，视觉偏好留给用户验收；后续用户已授权验收后提交、合入主干与推送；仍不发布。详细结果及步骤见 [交付记录](../logs/v0.50.1-unified-resource-workbench/README.md)。

## 补充与复盘

用户进一步明确滚动恢复、路由、导航和记忆是统一基础能力，已加入设计和 WV-09/10。初稿将现有恢复能力主要当作兼容约束，覆盖不足；本次在原设计 owner 修正并直接实现，不添加常驻规则。设计重审确认复用已有 navigation-history owner，不建立第二套历史/滚动注册系统。

继续执行纠偏：用户要求未完成不得停止，上一轮仅确认补充便结束是执行疏漏。已有 lifecycle 完成门足够，本次遵守原门继续实现，不新增规则。预览已按用户要求接真实服务 55667，前端仍为当前 worktree 的 5186；不操作无关业务数据；后续仅新建本任务只读 AI 验收会话验证引用往返，不执行资源内容或外发消息。

运行时纠偏：只启动 Vite、代理安装版后端不能证明 AI 源码变更生效。2026-09-11 02:06 用户明确授权中断当前任务并重启后，已用原生 `pnpm dev` 启动本 worktree，NEXTCLAW_HOME 保持 `/Users/peiwang/.nextclaw`，前端 5186、后端 55667；源码进程与原 SQLite 路径及代理健康接口已验证。没有复制独立数据。该缺口记录在本次原交付 owner，不新增规则。启动缺少的 QQ 扩展 dist 已构建；遵从用户要求，不为此额外重启。


2026-09-11 对象覆盖验证：真实 5186 定时任务菜单→主区→完整 Markdown 快照、已安装 Skill 卡片→主区→准确来源 SKILL.md 已通过。修复弹窗 body pointer-events/focus 边界拦截菜单点击，新增菜单测试；修复对象资产 Markdown 被当作不支持格式，新增原文快照不误读同名本地文件测试。AI 目录/解析与资产内容测试通过；CLI 目录在原数据运行时返回真实 60 个 Skill 分类信息。新增工具与 CLI 不是业务执行授权。

回归闭环：UI 全量 1341 通过、31 失败；只读基线 1269 通过、62 失败，当前 31 失败均在基线复现，无新增失败断言。全量后新增 URI 阅读身份与工作台最大化定向 8 测试通过。服务应用、MCP、项目工作项及项目 Skill 已接入，真实目录现包含 76 个默认/项目 Skill。kernel/CLI/类型检查、构建与 Review 结果见交付记录。\n\n最终复盘：AI 真实调用 resource_list 生成两类可点击链接，添加对象到聊天后的第二轮准确读取引用快照。发现同名对象快照可能串用阅读位置，已改为 URI 级身份并加回归；工作台子页不假装独立主页面，动作明确为最大化。既有设计与验收 owner 已更新，无需新增规则。

合入阶段复核：新增代码治理与公共入口检查已补齐，ViewMemoryStorage 独立承担浏览器存储 IO 边界；最新全量回归 1341 通过、31 基线失败、无新增失败。准备合并最新远程 master 后验证交叉点，普通 push，再运行 release:reconcile:mainline 同步主镜像。
