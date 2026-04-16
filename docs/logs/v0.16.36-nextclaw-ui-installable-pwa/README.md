# v0.16.36 nextclaw ui installable pwa

## 迭代完成说明

- 为 `packages/nextclaw-ui` 接入可安装 PWA 壳能力，让同一套主产品 UI 同时支持：
  - 浏览器直接访问
  - 本机 `localhost / 127.0.0.1` 访问后安装为 PWA
  - HTTPS 部署后通过浏览器安装为 PWA
- 新增了完整的 PWA 基建与宿主边界：
  - `manifest.webmanifest`
  - `sw.js`
  - `offline.html`
  - `pwa-192.png` / `pwa-512.png`
  - `src/pwa/*` 下的安装状态 store、install manager、runtime manager、入口注册和 UI 组件
- 产品层面采用“可安装入口壳”而不是“离线优先应用”：
  - 不缓存 `/api`、`/ws` 和业务动态数据
  - 不承诺离线聊天或离线配置
  - 安装后仍连接同一套本地或远端 NextClaw 服务
- UI 接入点：
  - [`packages/nextclaw-ui/src/app.tsx`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/app.tsx) 启动时注册 PWA，并挂载全局安装/更新提示
  - [`packages/nextclaw-ui/src/components/config/RuntimeConfig.tsx`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/config/RuntimeConfig.tsx) 增加常驻“安装为应用”卡片
  - [`packages/nextclaw-ui/index.html`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/index.html) 增加 manifest、theme-color、apple touch icon
  - 后续同批次微调中，已将顶部 PWA 更新提示卡片的视觉样式对齐到底部安装提示卡片，避免同一套 PWA 提示出现两种割裂的设计语言
  - 后续同批次修正中，已把顶部 PWA 更新提示的触发条件从“页面被 service worker 控制”收敛为“当前是已安装的 PWA 且存在 waiting update”，避免未安装用户误看到更新提示
  - 后续同批次视觉校正中，已将 PWA 壳的 `theme-color / theme_color` 从深色改为与主界面一致的浅暖色，避免安装后窗口或标题条出现突兀黑色外壳
  - 后续同批次交互修正中，已把“稍后再说”从单次内存状态改为带本地持久化的 banner snooze，并让 PWA store 首屏直接按本地冷却期初始化，避免开发或日常访问时刷新后又立刻重新弹出安装提示；用户仍可在 `Runtime` 页通过常驻卡片手动安装
- 设计文档见：
  - [2026-04-16-nextclaw-ui-pwa-installable-shell-design.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-16-nextclaw-ui-pwa-installable-shell-design.md)

## 测试/验证/验收方式

- 通过：
  - `pnpm -C packages/nextclaw-ui tsc`
  - `pnpm -C packages/nextclaw-ui test -- --run src/pwa/managers/pwa-install.manager.test.ts src/pwa/components/pwa-install-entry.test.tsx`
    - 已覆盖“再次触发 `beforeinstallprompt` 也不应把已 snooze 的安装 banner 重新拉起”与“用户关闭原生安装 prompt 后应进入本地冷却期”
  - `pnpm -C packages/nextclaw-ui test -- --run src/app.test.tsx src/components/layout/app-layout.test.tsx`
  - `pnpm -C packages/nextclaw-ui build`
  - `pnpm -C packages/nextclaw-ui exec eslint public/sw.js src/pwa/pwa.types.ts src/pwa/stores/pwa.store.ts src/pwa/managers/pwa-install.manager.ts src/pwa/managers/pwa-runtime.manager.ts src/pwa/register-pwa.ts src/pwa/components/pwa-install-entry.tsx src/pwa/managers/pwa-install.manager.test.ts src/pwa/components/pwa-install-entry.test.tsx src/lib/i18n.pwa.ts src/lib/i18n.ts src/app.tsx src/components/config/RuntimeConfig.tsx src/components/layout/AppLayout.tsx`
    - 结果：无 error；保留 `RuntimeConfig.tsx` 既有 `max-lines-per-function` warning
- 浏览器冒烟：
  - `pnpm -C packages/nextclaw-ui preview --host 127.0.0.1 --port 4174`
  - `curl -I http://127.0.0.1:4174/manifest.webmanifest`
  - `curl -I http://127.0.0.1:4174/sw.js`
  - `curl -I http://127.0.0.1:4174/offline.html`
  - Playwright 无头验证：
    - 首页可读取 `link[rel="manifest"]`
    - service worker 注册数为 `1`
    - 二次加载后 `navigator.serviceWorker.controller === true`
    - `/runtime` 页面出现 `Install as App` 卡片、`Installable` 状态和手动安装提示
    - 离线导航时命中 `offline.html` 文案而不是白屏
- 未通过但确认与本次 PWA 代码无关：
  - `pnpm -C packages/nextclaw-ui lint`
    - 被仓库内既有 `marketplace` 相关 `react-hooks/refs` 错误阻断，并非本次 PWA 变更引入
  - `pnpm lint:maintainability:guard`
    - 被仓库其他正在进行中的大文件/目录预算问题与历史 backlog 阻断；本次仅额外暴露，不是由 PWA 代码单独造成
  - `pnpm check:governance-backlog-ratchet`
    - 被历史 `docs/logs` 文档命名 backlog 阻断，当前基线已高于允许值

## 发布/部署方式

- 本次未执行正式发布。
- 若作为本地主产品 UI 交付，沿用现有 UI 构建链路：
  - `pnpm -C packages/nextclaw-ui build`
- 若后续跟随前端发布批次上线，沿用仓库现有前端发布流程：
  - 根目录 `pnpm release:frontend`
- 若以宿主产品形式发版：
  - 桌面端会消费同一套 UI 产物，但 Electron 宿主仍优先于 PWA 安装入口
  - 远端 HTTPS 部署时，部署产物中需包含 `manifest.webmanifest`、`sw.js`、`offline.html` 与 PWA 图标资源

## 用户/产品视角的验收步骤

1. 启动本地 NextClaw UI 或把同一套 UI 部署到 HTTPS 域名。
2. 用浏览器访问页面，确认页面 `<head>` 已包含 manifest。
3. 打开 `Runtime` 页面，确认能看到“Install as App / 安装为应用”卡片。
4. 在支持安装弹窗的浏览器中，确认可触发 `Install NextClaw`；若浏览器不主动弹窗，确认卡片会提示从浏览器菜单安装。
5. 点击右下角安装 banner 的“稍后再说”后，刷新页面或重新打开同一站点，确认右下角 banner 不会立刻再次出现，但 `Runtime` 页面里的安装卡片仍然可见。
6. 完成安装后，确认 NextClaw 以独立窗口打开，而不是新的产品分支页面。
7. 在已安装形态和普通浏览器形态间切换，确认聊天、配置、runtime 控制仍然连接同一套服务。
8. 断网后重新导航，确认看到的是明确的离线兜底页，而不是空白页。
9. 在 Electron 桌面宿主里打开同一套 UI，确认不会错误显示 PWA 安装入口。

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

- 本次顺着“统一入口、统一体验、开箱即用”的长期方向推进了一小步：NextClaw UI 现在不仅能在浏览器打开，也能被安装成更接近“默认入口”的应用壳。
- 这次刻意没有把需求做成“离线副本”或“浏览器里的第二宿主”，而是把复杂度收敛在一个新的 `src/pwa/` 边界内，避免把浏览器事件、安装状态和 SW 更新逻辑散落到现有聊天、runtime、desktop 代码里。
- 相比把逻辑塞进 `app.tsx`、`RuntimeConfig.tsx` 或现有 desktop manager，本次新增的代码虽然不少，但 owner 边界更清晰：
  - `PwaInstallManager` 负责安装状态与宿主抑制
  - `PwaRuntimeManager` 负责 SW 注册与更新
  - UI 组件只消费归一化状态
- 本轮续改继续朝“更少 surprise、更可预测”推进了一小步：安装 banner 现在受显式本地冷却期控制，而不是被浏览器每次重新分发 `beforeinstallprompt` 事件时偷偷重置。

### 可维护性复核结论

- 结论：保留债务经说明接受
- 本次顺手减债：是
- no maintainability findings

### 代码增减报告

- 新增：998 行
- 删除：4 行
- 净增：+994 行
- 统计口径：
  - 包含本次实际触达的 `packages/nextclaw-ui` 代码、PWA 公共资源和新增测试
  - 不包含方案文档、二进制 PNG 图标

### 非测试代码增减报告

- 新增：858 行
- 删除：4 行
- 净增：+854 行
- 说明：
  - 已排除 `*.test.*`
  - 仍包含 `manifest.webmanifest`、`offline.html`、`sw.js`、UI 入口、store、manager 与 i18n 文案

### 细项判断

- 本次是否已尽最大努力优化可维护性：
  - 是，在“一次性实现 PWA 能力”的前提下，已经把主要增长集中到新的 `src/pwa/` 子树，而不是继续膨胀既有 runtime / desktop / layout 文件。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：
  - 是。这里没有用插件黑盒硬塞一整套 PWA 框架，也没有为了兼容安装再复制一套页面入口；保留的是最小可用 manifest + SW + manager + UI。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 代码量与文件数净增长，原因是这是一次真实的新用户能力接入。
  - 这次已经尽量把增长收敛为单独的 `pwa` 边界，并避免把分支扩散到更多既有模块；剩余增长仍属最小必要。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：
  - 是。安装状态、SW 生命周期、UI 入口三层责任明确，没有新增“hook 套 hook”或把业务协调塞进 React effect。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 基本满足。本次新增代码集中在 `packages/nextclaw-ui/src/pwa/`，但 `packages/nextclaw-ui/src/lib` 目录仍然存在历史平铺压力；本次已通过新增 `i18n.pwa.ts` 避免继续把文案塞回超大文件。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：
  - 已基于独立复核填写。本结论不是对 guard 输出的复述，而是基于本次新增边界、代码增减和宿主职责收敛做的二次判断。

### 仍保留的维护性观察点

- `RuntimeConfig.tsx` 只是新增了 2 行挂载 PWA 卡片，但该文件本身仍接近体积预算上限；后续若 runtime 页面继续扩张，应优先拆出更清晰的 overview/card 组合层。
- 根级 `pnpm lint:maintainability:guard` 与 `pnpm check:governance-backlog-ratchet` 目前被仓库其他在途改动和历史 backlog 阻断，本次没有顺手清理这些非 PWA 债务。
- 后续如果继续增强 PWA 能力，优先 seam 应是：
  - 把更新提示与安装提示的视图状态抽成更独立的小组件
  - 持续避免把“浏览器安装能力”与“桌面宿主能力”重新耦合
