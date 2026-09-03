# Panel App 轻量独立宿主执行计划

上位设计：[Panel App 轻量独立宿主设计](../designs/2026-09-03-panel-app-standalone-lightweight-host.design.md)

## 最终结果

- contract-id：`panel-standalone-lightweight-host-v1`
- parent-goal：用户从 NextClaw 将任意 Panel App 打开到只显示该 App 的独立浏览器页面；页面连接当前 NextClaw、行为与主 App 一致，并且不加载或执行主工作台的非必要资源与生命周期。
- scope-revision：1
- scope-confirmation：用户确认“真正轻量化、不夹带非必要东西”，并授权方案、实现、充分验证和本地交付验收。

## 整体验收契约

- 必须成立：独立入口、共享 Panel runtime、单目标读取、生命周期组件索引、可恢复错误与量化性能。
- 必须不发生：通过 CSS/React 条件渲染伪装隔离；请求热路径全量 hash；复制 bridge/grant；standalone 启动主工作台副作用。
- 架构不变量：稳定 appId、同源认证、同一 content/asset/token/bridge/sandbox 合同；App Package lifecycle 是 active component snapshot 的唯一 owner。
- 代表性场景：workspace `inline-todo` 直接打开/刷新；package Panel 打开；client grant 允许/拒绝；not found；主 App 原入口。
- 交付边界：隔离 worktree 中完成代码、测试、构建和真实本地验收；commit、push、PR、release、deploy 未授权。
- 真实边界：不包含独立部署、公开分享、匿名访问、跨 origin 或 PWA 子应用。

## Active acceptance ledger

| ID | Required | 合同 | Status | 当前证据 | 失效原因 |
| --- | --- | --- | --- | --- | --- |
| PSLH-01 | true | standalone 路由返回独立 HTML 与独立前端入口 | passed | 生产 `GET /apps/panel/inline-todo/standalone` 返回 200、1,753 B，只引用 `panelStandalone-*` entry/CSS | - |
| PSLH-02 | true | 初始模块、CSS 和副作用不包含主工作台非必要能力 | passed | Vite manifest 静态闭包 18 文件，442,334 B raw / 131,715 B gzip；禁止依赖命中 0 | - |
| PSLH-03 | true | 主 App 与 standalone 共享唯一 runtime/bridge/grant/sandbox 合同 | passed | 两个入口均使用 `PanelAppHostPresenter` + `PanelAppRuntimeSurface`；bridge/runtime 定向测试通过 | - |
| PSLH-04 | true | standalone 用单目标 API，不请求完整 Panel 列表 | passed | `GET /api/panel-apps/:id` 在生产验收实例返回单个 descriptor；route/page/query 测试通过 | - |
| PSLH-05 | true | Panel 读取热路径不执行全量 App 完整性扫描 | passed | 读取改为 `AppPackageComponentCatalogService` snapshot 纯读；30 轮 descriptor/content p95 分别 5.19/5.05ms | - |
| PSLH-06 | true | package start/激活/变更保持完整性与 catalog 原子失效 | passed | catalog 原子 snapshot 测试、App Package lifecycle 22 项及受影响 Kernel 26 项通过 | - |
| PSLH-07 | true | 直接进入、刷新、认证、not-found、授权和连接失败可恢复 | passed | 独立 route/page、bridge/grant 定向测试通过；真实 unknown id 返回结构化 404；登录表面为延迟入口 | - |
| PSLH-08 | true | 生产首次可见 <=1s、热刷新 <=500ms，开发态无后端扫描 | passed | 独立生产实例 30 轮：HTML p95 3.24ms，descriptor 5.19ms，content 5.05ms，18 资源并发闭包 11.87ms；热路径无 hash | 浏览器主观视觉验收由用户在交付 URL 完成 |
| PSLH-09 | true | 主 App Panel 与打开菜单无行为退化 | passed | UI 7 个定向测试文件、21 项通过，覆盖主页、列表、toolbar、菜单和 bridge | - |
| PSLH-10 | true | tsc、测试、构建图、可维护性和真实浏览器证据完整 | partial | UI/SDK/Kernel/Server/NextClaw tsc/build，UI 21、Server 25、Kernel 26、runner cache 14 项定向测试，lint/governance/diff-only maintainability 均无 error；真实生产 HTTP 链路通过 | Codex 内置浏览器处于 `data:` 错误页且安全策略禁止自动跳转到 localhost，不绕过策略；保留隔离验收 URL 供用户视觉确认 |

## 阶段图

| 阶段 | 可验收结果 | 进入下一阶段的门 | 状态 |
| --- | --- | --- | --- |
| A. 入口与共享宿主 | 独立 entry 用最小 providers 打开 workspace Panel | PSLH-01/02/03/04 有定向证据 | completed |
| B. 后端 target/catalog | 单目标 resolver 与 lifecycle snapshot 替代请求扫描 | PSLH-05/06 有定向证据 | completed |
| C. 行为与性能验证 | 两种 Panel 来源、授权、刷新、构建图和时延通过 | PSLH-07/08/09 通过，PSLH-10 仅剩用户视觉验收 | completed |
| D. Review 与交付 | 无 finding，文档和本地验收入口可用 | 客观检查通过，验收 URL 可用 | ready-for-user-acceptance |

## 执行部分

### A. 独立前端入口与共享宿主

- owner：`@nextclaw/ui` app 装配与 `features/panel-apps`。
- 结果：Vite 双 HTML entry；dev/prod route 映射；最小 Theme/i18n/auth；Panel Host Runtime provider；单目标 query；删除旧 `ProtectedApp` route。
- 策略：复用上位设计；若授权行为要求主 App 全局 runtime，返回 Design，禁止静默夹带。
- 验证：entry/route/provider 单测、网络请求断言、UI tsc、构建 manifest closure。

### B. 后端 active component catalog

- owner：App Package lifecycle + Panel target resolver。
- 结果：经验证的 active component snapshot；单目标 descriptor；content/open 复用 resolver；read 不 hash。
- 策略：复用上位设计；若 lifecycle 无原子变更点，先返回 Design 更新生命周期图。
- 验证：start/enable/update/rollback/disable/uninstall 状态矩阵、完整性失败、read 纯度、Kernel/Server tsc。

### C. 集成、性能与回归

- owner：Validation。
- 结果：workspace/package Panel 在主 App 与 standalone 行为一致；冷/热指标满足契约；错误恢复完整。
- 验证：生产构建、构建图、真实独立 backend/preview、浏览器计时和定向测试。

### D. Review、文档与本地交付

- owner：Review/Delivery/Retrospective。
- 结果：无未关闭 finding；中英文文档准确；本地验收 URL 可打开；判断是否需要迭代留痕。
- 策略：不发布；不因未授权 commit/push 缩减本地交付。

## 当前阶段门

- 结果：实现、客观验证、Review 和本地生产交付已完成，进入用户视觉验收。
- 保持项：稳定 URL、共享 Panel 行为、主 App 不退化、完整性边界不降低均已有证据。
- 验收入口：`http://127.0.0.1:18899/apps/panel/inline-todo/standalone`（隔离 home 和端口，不影响用户当前 15174/18792 实例）。
- 未授权事项：commit、push、PR、release 和 deploy 均未执行。
- 唯一未自动关闭项：Codex 内置浏览器的 localhost 安全策略阻止视觉自动化；需用户打开上述 URL 确认视觉偏好。

## 中断恢复入口

1. 读取本文件 ledger 与当前阶段门；
2. 运行 `git status --short`，只触达本分支既有 WIP；
3. 从第一个 `not-run` 或 `failed` 的 Required ID 继续；
4. 不重新采用已被真实证据否决的 `ProtectedApp` 内路由。

## 被删除的噪声标准

- 不按文件数或是否命名为“独立 App”验收；只看资源和生命周期边界。
- 不引入无当前消费者的微前端、跨 origin 或独立部署机制。
- 不用 HTTP 200、热缓存截图或 mock 代替冷启动与真实依赖图。
