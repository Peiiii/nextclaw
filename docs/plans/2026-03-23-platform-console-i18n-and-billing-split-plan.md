# Platform Console 国际化与 Billing 模块收敛方案

## 背景

当前 `apps/platform-console` 有两个明显问题：

1. 页面文案几乎全部直接写在 TSX 中，缺少国际化基础设施。
2. 用户首页把“远程实例/分享”和“额度/充值”混在同一个面板里，导致产品主线不清晰，而 billing/recharge 目前又未 ready，不适合继续前置暴露。

## 目标

1. 为 `platform-console` 建立最小可用的国际化基础设施。
2. 文案必须存放在 `.json` 文件中，而不是硬编码在代码里。
3. 当前首页收敛为“实例中心”，只强调远程访问和分享能力。
4. billing 模块暂时不透出真实能力，改为弱提示的“即将上线”占位。

## 本次范围

- 覆盖 `platform-console` 当前用户面板主要页面：
  - `App.tsx`
  - `LoginPage.tsx`
  - `UserDashboardPage.tsx`
  - `SharePage.tsx`
- 新增：
  - `zh-CN.json`
  - `en-US.json`
  - locale store
  - i18n service
  - locale switcher
  - i18n key 一致性检查脚本

## 非范围

- 暂不对 `platform-admin` 做完整国际化。
- 暂不恢复 billing/recharge 的真实用户入口。
- 暂不引入第三方 i18n 框架；先使用项目内轻量实现，确保结构清晰、易迁移。

## 设计决策

### 1. 文案存放方式

使用 JSON 作为唯一文案源：

```text
apps/platform-console/src/i18n/locales/
  zh-CN.json
  en-US.json
```

代码中只允许通过 `t('key.path')` 读取文案，不再直接写死用户可见字符串。

### 2. 语言范围

首期支持：

- `zh-CN`
- `en-US`

默认策略：

- 优先读取用户已选择并持久化的 locale
- 否则回退到浏览器语言
- 最后回退到 `en-US`

### 3. 技术结构

- `locale.store.ts`：负责语言状态、浏览器检测、localStorage 持久化
- `i18n.service.ts`：负责 JSON 文案装载、key 路径解析、插值
- `locale-switcher.tsx`：统一的语言切换 UI
- `platform-console-i18n-check.mjs`：校验 `zh-CN.json` / `en-US.json` key 是否一致

### 4. 首页产品结构

用户首页改成两块：

1. `我的实例`
   - 实例列表
   - 打开实例
   - 创建分享链接
   - 撤销分享链接

2. `用量与充值`
   - 仅显示 `Coming Soon / 即将上线`
   - 不展示余额、额度、充值申请、消费流水

### 5. 行为约束

- 远程实例是当前主模块，应继续作为首页主内容。
- billing 当前未 ready，因此不能继续提供“半可用”的充值流程入口。
- 货币、时间、日期格式不放到 JSON 中，继续在代码里通过 `Intl` 按 locale 格式化。

## 验证方案

1. `pnpm -C apps/platform-console build`
2. `pnpm -C apps/platform-console lint`
3. `pnpm -C apps/platform-console tsc`
4. `node scripts/platform-console-i18n-check.mjs`
5. 本地 preview + Playwright 冒烟：
   - 默认英文浏览器能看到英文登录文案
   - 切换到中文后能看到中文文案
   - 首页不再出现 recharge/ledger 等 billing UI
   - 首页出现 `Coming Soon / 即将上线` 占位
6. 正式发布 `platform-console`
7. 线上首页 `200`

## 发布策略

- 本次仅涉及 `platform-console` 前端页面与本地脚本
- 不涉及数据库 migration
- 发布方式：
  - `pnpm deploy:platform:console`

## 验收标准

1. `platform-console` 具备中英文切换能力。
2. 所有首批文案来自 JSON 文件，不再硬编码在 TSX 中。
3. 用户首页主视图只聚焦远程实例与分享。
4. billing/recharge 不再以前台真实功能形态暴露，而是改成即将上线占位。
