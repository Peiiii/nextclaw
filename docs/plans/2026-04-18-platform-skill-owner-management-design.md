# Platform Skill Owner Management Design

## 背景

当前 marketplace 已经有管理员审核链路：

- 管理员可以审核 `pending / published / rejected`
- 用户可以发布个人 scope skill
- 用户平台 `platform-console` 目前只负责账号与实例，不负责用户自己已发布 skill 的后续管理

这会带来两个直接问题：

1. 用户一旦发布成功，就缺少正式的一等入口去管理自己的 skill。
2. “管理员审核状态”和“发布者自主管理状态”还没有解耦，导致隐藏、下架、删除这些动作没有稳定语义。

## 目标

在用户侧正式交付一套轻量但完整的 skill 自主管理能力，覆盖：

- 查看自己名下的 skill 列表
- 查看当前审核状态与公开状态
- 将已发布 skill 隐藏 / 重新公开
- 将自己上传的 skill 从 marketplace 删除

## 方案选择

采用“双状态模型”，而不是把所有动作都塞进 `publish_status`：

- 审核状态：`pending | published | rejected`
- 发布者管理状态：
  - `owner_visibility = public | hidden`
  - `owner_deleted_at = nullable timestamp`

原因：

- 审核状态属于管理员治理语义，不应被发布者直接篡改。
- “隐藏”与“删除”是发布者自己的分发控制，不是审核结论。
- 后续如果要支持“恢复公开”“展示已删除记录”“申诉再审”等能力，这套模型更稳。

## 数据规则

公共 marketplace 可见条件统一收敛为：

- `publish_status = published`
- `owner_visibility = public`
- `owner_deleted_at IS NULL`

行为规则：

- `hide`
  - 仅改变 `owner_visibility = hidden`
  - 不改变管理员审核结论
- `show`
  - 仅改变 `owner_visibility = public`
  - 只有审核已通过的 skill 才会重新进入公共 marketplace
- `delete`
  - 写入 `owner_deleted_at`
  - 从公共 marketplace 中移除
  - 用户侧默认列表不再展示该 skill

## API 设计

### marketplace-api

新增发布者自助接口：

1. `GET /api/v1/user/skills/items`
2. `GET /api/v1/user/skills/items/:selector`
3. `POST /api/v1/user/skills/manage`

约束：

- 必须使用平台登录 Bearer token
- 只能操作 `owner_user_id = 当前用户` 的 skill
- 官方 `@nextclaw/*` skill 不走这条链路

### provider-gateway-api

对用户平台暴露统一入口：

1. `GET /platform/marketplace/skills`
2. `GET /platform/marketplace/skills/:selector`
3. `POST /platform/marketplace/skills/:selector/manage`

职责：

- 复用平台登录态鉴权
- 代理 marketplace-api 用户侧接口
- 记录用户自主管理 audit log

## 前端设计

在 `platform-console` 经典工作台内新增独立页面：

- `My Skills`

页面结构保持轻量：

- 顶部说明卡：解释审核状态与公开状态的区别
- 主列表：展示 skill 名称、包名、审核状态、公开状态、最近更新时间
- 行内操作：
  - `隐藏`
  - `重新公开`
  - `删除`

不做复杂版本对比、文件 diff、批量操作、回收站。

## 交互规则

- `pending / rejected`
  - 允许继续删除
  - 允许保持 `hidden`，但不会出现在公共 marketplace
- `published + public`
  - 可执行隐藏
- `published + hidden`
  - 可执行重新公开
- `delete`
  - 二次确认
  - 成功后从默认列表移除

## 验证

至少覆盖：

- marketplace-api 的 owner list/detail/manage
- provider-gateway-api 的用户代理接口与 owner 鉴权
- platform-console 的 `My Skills` 页面
- UI 冒烟：
  - 打开 `My Skills`
  - 点击隐藏 / 重新公开 / 删除
  - 状态与按钮即时更新

## 非目标

本次不做：

- 已删除 skill 恢复
- 批量操作
- 举报 / 申诉
- 版本历史
- 上传入口重做
