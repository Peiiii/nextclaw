# Marketplace Review In Platform Admin Design

## 背景

当前 NextClaw 已具备 scoped skill 发布能力：

- 官方 scope：`@nextclaw/*`
- 个人 scope：`@<username>/*`
- 个人 skill 发布后默认进入 `pending`

但审核链路仍停留在隐藏的 admin API：

- `POST /api/v1/admin/skills/review`

这导致三个直接问题：

1. 管理员明明有独立后台，却仍要用脚本或手工 API 审核，治理入口割裂。
2. 发布者只能感知“发了但没上架”，无法在正式产品入口里看到待审核、拒绝原因与结果。
3. Marketplace 作为生态入口缺少统一治理控制面，削弱 NextClaw 作为“统一入口与能力编排层”的产品可信度。

## 长期目标对齐

该方案直接服务 NextClaw 产品愿景中的三条主线：

- 统一入口：管理员通过统一后台完成平台治理，不再依赖隐性运维接口。
- 能力编排：平台后台、平台网关、marketplace worker 形成清晰分工，而不是把治理逻辑散落在脚本和手工 curl 中。
- 自感知与自治：系统能够显式呈现 skill 的发布状态、审核动作、审核备注与治理结果，避免“后台知道、用户不知道”的黑箱。

## 目标

在 `platform-admin` 中交付一个正式可用的 Marketplace 审核治理区块，覆盖：

- 待审核队列
- Skill 详情审查
- 通过 / 拒绝动作
- 审核备注
- 审核后的状态回写与结果校验

## 非目标

本次不做：

- 独立的 marketplace-admin 新站点
- 推荐位配置、举报处理、下架申诉
- 发布者自助后台页面
- 文件 diff、版本对比、批量审核

这些能力后续可以在同一治理模块上扩展，但不应阻塞第一版正式上线。

## 产品方案

### 方案选择

采用“平台后台统一承接”的方案：

- `platform-admin`：管理员正式审核入口
- `nextclaw-provider-gateway-api`：统一管理 API 与管理员身份校验、审计入口
- `marketplace-api`：skill 审核对象的真实数据源与状态写入点

不采用“继续让管理员手工调 marketplace API”或“再做一个独立 marketplace 管理后台”的方案。

### 管理员主流程

1. 管理员登录 `platform-admin`
2. 在 `Marketplace 审核` 区块查看状态摘要与待审核队列
3. 按状态、关键词过滤 skill
4. 选中某个 skill 后查看详情：
   - 包名
   - scope / 发布者
   - 发布时间 / 更新时间
   - 标签、摘要、描述
   - `SKILL.md`
   - `marketplace.json`
   - 文件清单
5. 管理员执行：
   - 通过
   - 拒绝
6. 若拒绝，必须填写审核备注；若通过，备注可选但建议填写
7. 动作成功后：
   - 队列刷新
   - 当前项状态更新
   - 平台审计日志记录动作
   - marketplace 可见性同步生效

### 发布者可感知结果

本次先保证治理链路中至少有“审核备注”这一产品数据存在。

即使发布者后台页本次不做，也必须让系统层面具备：

- `publishStatus`
- `reviewNote`
- `reviewedAt`

这样后续才能自然接入发布者侧状态页，而不是再次补 schema。

## 信息架构

第一版不新增复杂路由结构，直接在 `platform-admin` 现有 dashboard 中新增独立治理区块：

- `Marketplace 审核`

区块内部由两栏组成：

- 左侧：状态摘要 + 队列列表
- 右侧：skill 详情 + 审核动作

这样可以在不打散现有后台结构的前提下，让审核成为正式一等能力，而不是又一个弹窗工具。

## 数据与状态设计

### 核心状态

- `pending`
- `published`
- `rejected`

### 新增审核元数据

在 `marketplace_skill_items` 上补充：

- `review_note TEXT`
- `reviewed_at TEXT`

规则：

- 用户重新 publish / update 进入新一轮审核时，清空旧 `review_note` 与 `reviewed_at`
- `reviewed_at` 仅在管理员执行通过/拒绝后写入
- `review_note` 在拒绝时必填，在通过时可为空

### 审核动作约束

- `approve` 等价于将 `publish_status` 写为 `published`
- `reject` 等价于将 `publish_status` 写为 `rejected`
- `reject` 必须附带非空 `reviewNote`
- `approve` 可选附带 `reviewNote`

## API 设计

### Marketplace API

新增管理员专用接口：

1. `GET /api/v1/admin/skills/items`
   - 查询 skill 审核列表
   - 支持：
     - `publishStatus=pending|published|rejected|all`
     - `q`
     - `page`
     - `pageSize`

2. `GET /api/v1/admin/skills/items/:selector`
   - 返回单个 skill 的管理员详情
   - `selector` 支持包名或 slug
   - 返回：
     - item 基础信息
     - 文件清单
     - `SKILL.md` 原文
     - `marketplace.json` 原文

3. `POST /api/v1/admin/skills/review`
   - 保留现有入口，但扩展请求体：
     - `selector`
     - `publishStatus`
     - `reviewNote?`

### Platform Gateway API

新增统一平台后台接口：

1. `GET /platform/admin/marketplace/skills`
2. `GET /platform/admin/marketplace/skills/:selector`
3. `POST /platform/admin/marketplace/skills/:selector/review`

职责：

- 使用平台管理员登录态做权限校验
- 调用 marketplace admin API
- 记录平台 audit log
- 对前端暴露稳定统一的后台契约

## 前端交互设计

### 摘要区

展示三个数字：

- 待审核数
- 已发布数
- 已拒绝数

### 列表区

支持：

- 状态切换
- 关键词搜索
- 分页
- 选中高亮

每条记录至少展示：

- 名称
- 包名
- 发布者
- 当前状态
- 更新时间

### 详情区

展示：

- 名称、包名、scope、发布者
- 标签、摘要、描述
- 当前状态、发布时间、更新时间、最近审核时间
- 审核备注
- `SKILL.md`
- `marketplace.json`
- 文件清单

### 动作区

- 通过按钮
- 拒绝按钮
- 审核备注输入框

交互规则：

- 拒绝时备注必填
- 动作中锁定按钮，避免重复提交
- 成功后给出清晰提示并刷新列表/详情

## 可维护性原则

### 删减优先

第一版只做一个治理区块，不拆多页面、多 tab、多级导航。

### 清晰边界

- marketplace worker 负责 skill 审核对象数据
- provider gateway 负责平台管理员统一入口与审计
- platform-admin 负责治理 UI

避免把审核业务逻辑同时塞进前端和多个后端。

### 数据前置

先把 `review_note` / `reviewed_at` 正式落库，而不是先做 UI 再靠前端本地文案假装拒绝原因存在。

## 验证方案

### 后端

- marketplace-api：
  - 管理员列表接口
  - 管理员详情接口
  - review note 校验
- provider-gateway-api：
  - 管理员接口鉴权
  - marketplace 代理成功/失败路径
  - audit log 记录

### 前端

- `platform-admin`：
  - 列表加载
  - 详情切换
  - 通过
  - 拒绝备注必填
  - 提交后状态刷新

### 冒烟

真实链路最少验证：

1. 让一个个人 skill 处于 `pending`
2. 在 `platform-admin` 中看到该 skill
3. 在详情中查看 `SKILL.md` 与 `marketplace.json`
4. 点击通过后，公开 marketplace 能查到
5. 再让 skill 回到 `pending` 或构造新的 pending skill，点击拒绝并填写备注
6. 确认后台显示 `rejected` 与审核备注

## 发布与上线要求

- `platform-admin` 构建通过
- `nextclaw-provider-gateway-api` 类型与测试通过
- `marketplace-api` 类型与测试通过
- 生产环境需要补齐 `MARKETPLACE_API_BASE` 与 `MARKETPLACE_ADMIN_TOKEN`

## 成功标准

当以下条件同时成立时，认为本次方案完成：

- 管理员无需手写 curl 即可完成 skill 审核
- 审核入口存在于正式平台后台，而不是隐藏运维路径
- 通过/拒绝结果能真实影响 marketplace 可见性
- 拒绝原因可被系统记录，而不是只存在于口头沟通
- 整体实现保持单一治理入口，不新增第二个后台站点
