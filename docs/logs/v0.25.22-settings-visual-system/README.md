# 设置界面视觉体系统一

## 迭代完成说明

本次把设置界面从页面各自堆叠卡片的结构，统一为“页面、分区、设置组、设置行”四级视觉体系。普通设置项复用 `SettingsSection`、`SettingsGroup` 和 `SettingRow`；提供商、渠道与搜索复用自适应 `ConfigSplitPage`，在内容区不足 640px 时切换为列表—详情钻取，避免双栏被侧面板挤压。

模型、提供商、渠道、搜索、外观、登录管理、路由与运行时、更新、远程访问、密钥管理和 MCP 页面均完成迁移或适配。MCP 保留商品卡片的独立内容语义，但移除了页面级大卡片和窄容器横向溢出。中文语言包中的 `Security`、`Secret Providers`、`Secret Refs`、`Vision` 和 `Side chat` 英文占位已改为自然中文，其中原“安全”入口根据实际功能收敛为小白用户也能理解的“登录管理”。

规范同时沉淀在 `docs/designs/2026-07-18-settings-visual-system.design.md` 与 `frontend-style-encapsulation` skill，后续设置页默认执行相同边框预算、密度、token、共享组件和真实响应式验收要求。

后续逐页对比确认设置页仍残留两套页面画布：模型、外观等普通页自行使用 `max-w-5xl`，提供商、渠道、搜索和 MCP 使用外层完整宽度，导致同一 1280px 视口下正文宽度分别为 1024px 与 1104px，左右起止线相差 40px；页面根级 `space-y-*` 又让标题到正文同时存在 24px、28px 和 44px 三种节奏。根因是业务页各自拼接 `PageLayout` 宽度、高度与间距类，而 shared 层没有页面级设置语义 owner。现已新增纯展示 `SettingsPage`，11 个设置路由统一到 1104px 内容起止线与 24px 标题节奏，只保留普通页和列表—详情页两种结构变体。

模型页的 `Default Model` 与相邻 `Workspace` 并非缺少 locale key，而是后端 Schema `uiHint.label` 的英文值直接覆盖了前端本地化标签。现已停止把 Schema label 作为用户可见文案，复用既有 `defaultModel` 与 `workspace` i18n key 作为可访问标签；Schema 仍只提供 placeholder/help。这个修复同时删除了设置行标题下方的重复可见标签。同类扫描还让提供商详情的已知字段改为使用 `API 密钥`、`请求接口`、`额外请求头` 等前端 i18n owner，并让搜索详情不再直接显示后端英文描述。针对这次静态 locale 扫描漏掉运行时派生文案的验证缺口，`frontend-style-encapsulation` skill 已增加“审计 Schema/uiHint 派生文案并用真实 DOM 验收”的执行规则。

高级配置入口按使用理解成本重新排序为“外观、登录管理、搜索渠道、更新、远程访问、路由与运行时、密钥管理、MCP”；其中外观与登录管理前置，路由与运行时放在倒数第三位，其余入口保持原有相对顺序。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui lint`：0 error；保留一个与本次无关的 `cron-config.tsx` 既有复杂度 warning。
- `pnpm -C packages/nextclaw-ui build`：通过；仅保留既有 Browserslist 数据陈旧与大 chunk 提示。
- 设置域定向测试：15 个测试文件、41 个测试全部通过。
- “登录管理”命名微调：布局与文档标题相关的 3 个测试文件、11 个测试全部通过。
- 高级配置顺序微调：桌面侧栏与移动设置入口相关的 2 个测试文件、7 个测试全部通过。
- 页面画布与模型标签回归：12 个设置相关测试文件、30 个测试全部通过；新增 `SettingsPage` 普通/分栏变体合同测试，并覆盖 Schema 返回英文 label 时中文页面仍只显示“默认模型”“工作空间”。
- `pnpm -C packages/nextclaw-ui test`：全量测试发现 5 个与本次无关的既有失败，其中 4 个欢迎页测试缺少 `QueryClientProvider`，1 个会话工作区刷新测试失败；本次设置相关测试保持全绿。
- 真实运行实例 `http://127.0.0.1:5174`：逐页检查 11 个设置入口；模型、提供商、渠道、搜索、外观、登录管理、运行时、更新、远程访问、密钥和 MCP 均无横向溢出。
- 真实尺寸：1440×900 桌面双栏、1000×760 且文档侧面板打开后的 468px 内容区、390×844 移动端；提供商列表—详情—返回链路均可操作。
- 中文实页确认侧边栏入口、页面标题和浏览器标题均显示“登录管理”，页面说明为“设置进入 NextClaw 时是否需要登录，并管理登录账号和密码。”；中文标题静态扫描仅剩 `NextClaw Client SDK` 与 `MCP Doctor` 两个正式名称。
- 真实运行实例 `http://127.0.0.1:5174/appearance`：侧栏高级配置顺序确认为“外观、登录管理、搜索渠道、更新、远程访问、路由与运行时、密钥管理、MCP”。
- 真实运行实例逐页坐标复验：模型、提供商、渠道、外观、登录管理、搜索、更新、远程访问、运行时、密钥和 MCP 的标题、正文均为 `left=88 / right=1192 / width=1104`，标题到首个正文表面均为 24px；模型页 DOM 不再出现 `Default Model` 或 `Workspace` 英文标签。
- `pnpm check:governance-backlog-ratchet`：通过；`pnpm lint:new-code:governance` 的文件名、目录名和文档名检查均通过，随后被当前工作区中与本次设置任务无关的 `apps/platform-console/src/api/client.ts` 与 `workers/nextclaw-provider-gateway-api/src/types/platform.ts` 既有命名问题阻断。

## 发布/部署方式

本轮只修改源码、测试、设计规范和发布片段，不执行部署、NPM 发布、runtime update、桌面安装包发布或服务重启。变更由当前 Vite 开发实例热更新消费并完成验收；后续随统一发布流程进入 `@nextclaw/ui` patch 版本。

## 用户/产品视角的验收步骤

1. 打开设置，依次进入模型、外观、登录管理、远程访问和密钥管理，确认设置项使用紧凑分组、低对比度分隔线和一致的控件对齐，不再每项套一张卡片。
2. 进入提供商、渠道和搜索页，确认桌面宽度下列表与详情并列，选中态使用填充而不是叠加描边。
3. 打开右侧帮助文档侧面板或缩窄窗口，确认列表页自动切换为单栏；选择项目后显示详情，并可通过返回入口回到列表。
4. 在 390px 移动端进入外观与提供商页，确认无横向溢出，主题、语言、消息布局和提供商详情仍可操作。
5. 在中文语言下进入登录管理与密钥管理，确认标题显示“登录管理”“密钥提供器”“密钥引用”，不再出现英文占位。
6. 查看高级配置入口，确认顺序为“外观、登录管理、搜索渠道、更新、远程访问、路由与运行时、密钥管理、MCP”。
7. 在模型、提供商、外观、登录管理和 MCP 之间切换，确认页面标题与正文始终落在同一左右起止线；模型页只显示“默认模型”“工作空间”，不再重复英文标签。

## 可维护性总结汇总

- `post-edit-maintainability-guard --non-feature`：0 error，非测试代码 `+1384 / -1402 / 净减 18`。
- 页面画布、加载态与运行时派生文案收尾 scoped guard：19 个文件，0 error、1 个未增长的历史 warning；总变更 `+894 / -872 / 净增 22`，其中新增主要来自回归测试；非测试代码 `+842 / -871 / 净减 29`。warning 为 `provider-form.tsx` 保持 563 行、未继续增长。
- 高级配置顺序微调的 scoped guard：0 error、0 warning；总变更 `+16 / -16 / 净增 0`，非测试代码 `+8 / -8 / 净增 0`。
- 正向减债动作：删除各设置页重复的 Card 外壳，复用共享设置原语；资源管理页收敛到单一 `ConfigSplitPage` 响应式 owner；MCP 删除独立页面级视觉体系。
- 页面级 owner 进一步收敛到 `SettingsPage`：删除 11 个路由重复的 `max-w-*`、`mx-auto`、根级 `space-y-*`、`PageHeader` 和分栏高度拼接；业务页只传本地化标题、说明、操作与结构变体。
- 未新增业务状态 owner、manager、store 或平行样式系统。新增的 `ResizeObserver` 只同步外部容器尺寸，业务选择状态仍由各页面负责。
- 历史提醒：`provider-form.tsx` 仍超过 500 行，`channel-form.tsx` 接近 500 行，但本次均未增长；后续若继续增加业务字段，应优先拆出表单状态与分区 owner。

## NPM 包发布记录

- 需要随统一发布流程发布 `@nextclaw/ui` patch 版本，原因是设置视觉、响应式行为与中文标题均为用户可见变化。
- 已更新 `.changeset/settings-sidebar-footer-spacing.md`，当前状态为待统一发布。
- 本轮未执行 NPM 发布。
