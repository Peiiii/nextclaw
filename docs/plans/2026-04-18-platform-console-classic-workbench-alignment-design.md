# Platform Console Classic Workbench Alignment Design

## 背景

`platform-admin` 已经收敛成了经典后台控制台骨架，但 `platform-console` 仍然停留在另一套视觉和布局体系里：

- 冷蓝色背景和营销页式氛围更强
- 顶部横向导航 + 卡片堆叠的结构不够稳定
- 用户平台和管理后台看起来像两套独立产品，而不是同一体系下的两个入口

这会直接削弱 NextClaw 作为统一入口和统一控制面的产品感知。用户从 `platform.nextclaw.io` 切到 `platform-admin.nextclaw.io` 时，不应该感觉像进入了完全不同的产品。

## 长期目标对齐

这次改动服务三个长期方向：

- 统一入口：用户平台和管理后台要显得属于同一个 NextClaw 控制面体系
- 统一体验：视觉、密度、页面骨架和可复用组件需要收敛
- 可持续扩展：后续再新增用户侧页面时，不应该继续临时拼布局

## 我的判断

推荐方案是：

- 直接把 `platform-console` 收敛到和 `platform-admin` 同一套经典控制台骨架
- 视觉继续沿用 NextClaw UI 的暖中性色 + olive brand
- 但用户侧保留更轻的“工作台”感，不做成强治理语气

不推荐只做换色或局部打磨，因为那样只能让页面“更像一点”，无法解决骨架和信息架构不统一的问题。

## 目标结构

### 1. 统一壳层

用户平台改为与管理后台同源的经典骨架：

- 左侧固定导航
- 顶部固定全局栏
- 中间内容区独立滚动

用户侧导航保持极简，只保留：

- `我的实例`
- `账号`

侧边栏底部收纳：

- 当前登录邮箱
- 用户角色
- 语言切换
- 退出登录

### 2. 页面分层

#### 我的实例

这是用户默认首页，结构收敛为：

- 顶部摘要指标区
- `Remote 额度` 面板
- `我的实例` 工作台
- `用量与充值` 占位面板

不再保留过重的营销式头图和漂浮 header。

#### 账号

单独作为稳定页面，而不是通过顶部 tab 高亮模拟路由。

结构为：

- 账号概览摘要
- 用户名准备状态 / 个人发布 scope
- 标准网页入口 / CLI 兜底命令

### 3. 登录页与分享页

虽然登录页和分享页不进入用户工作台壳层，但视觉必须跟新体系对齐：

- 暖中性背景
- 更克制的卡片、边框和阴影
- 保留双栏登录信息，但去掉冷蓝营销感
- 分享页改成和控制台一致的品牌语气

## 组件化目标

本次新增一组用户侧可复用组件：

- `ConsoleShell`
  - 用户工作台壳层
- `ConsolePage`
  - 页面标准容器
- `ConsoleToolbar`
  - 操作栏 / 辅助控制区
- `ConsoleSurface`
  - 统一表面容器
- `ConsoleMetricCard`
  - 摘要指标卡

这些组件会和 `platform-admin` 的框架风格对齐，但命名和文案更偏用户工作台。

## 非目标

本次不做：

- 重写 remote API
- 新增新的业务模块
- 提前开放真实 billing
- 重做账号能力模型
- 把用户平台变成管理后台副本

本次只做一件事：

把 `platform-console` 收敛成和 `platform-admin` 同体系的经典用户工作台。

## 验证与发布

收尾必须完成：

1. `pnpm -C apps/platform-console tsc`
2. `pnpm -C apps/platform-console lint`
3. `pnpm -C apps/platform-console build`
4. 本地预览 + `PLATFORM_CONSOLE_BASE_URL=http://127.0.0.1:4173 pnpm smoke:platform:console`
5. `pnpm deploy:platform:console`
6. `curl -I https://platform.nextclaw.io`
7. `PLATFORM_CONSOLE_BASE_URL=https://platform.nextclaw.io pnpm smoke:platform:console`
