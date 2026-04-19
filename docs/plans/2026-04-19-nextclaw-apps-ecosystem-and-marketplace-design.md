# NextClaw Apps 第二阶段 PRD（冻结稿）

## 1. 文档状态

- 状态：冻结稿
- 用途：直接作为本轮实现、验证、发布、部署与提交的执行依据
- 范围原则：本文件定义的就是本轮完整范围，不再额外扩散成开放式讨论

## 2. 产品定义

`NextClaw Apps` 是一套面向 NextClaw 生态的小应用形态：

- 应用可以独立开发、打包、分发、安装、运行
- 应用默认以轻量本地 app 为主，不把开发者直接暴露在复杂宿主耦合里
- 应用既可以有界面，也可以通过宿主能力访问受控的本地能力
- 用户获取 app 的主路径是“独立 web app store + 本地 CLI 安装运行”

这一轮不是在做“大而全的平台替代品”，而是在把 `NextClaw Apps` 收敛成一个可真正使用、可真正传播、可真正发布的产品闭环。

## 3. 本轮版本目标

本轮只交付一个结果：

**把现有 `@nextclaw/app-runtime` 的本地 MVP，推进为一个可发布、可发现、可安装、可更新的完整 NextClaw Apps 产品闭环。**

完成后要成立这条真实链路：

`开发 app -> napp publish -> 官方 registry 收录 -> apps.nextclaw.io 展示 -> 用户复制安装命令 -> napp install -> napp run`

## 4. 域名与对外入口

本轮域名直接冻结，不再悬而未决。

### 4.1 推荐并采用的正式方案

- 人类入口：`https://apps.nextclaw.io`
- 机器入口：`https://apps-registry.nextclaw.io`

### 4.2 各自职责

`apps.nextclaw.io`

- 独立 web app store
- 首页、列表页、详情页、发布者页
- 面向用户和开发者的公开展示入口

`apps-registry.nextclaw.io`

- app 列表 API
- app 详情 API
- registry metadata API
- bundle 下载 API
- publish API
- 作为 CLI 默认 registry

### 4.3 默认路径冻结

- web 首页：`https://apps.nextclaw.io/`
- app 详情页：`https://apps.nextclaw.io/apps/<slug>`
- 发布者页：`https://apps.nextclaw.io/publishers/<publisher-id>`
- 默认 registry base：`https://apps-registry.nextclaw.io/api/v1/apps/registry/`
- apps API base：`https://apps-registry.nextclaw.io/api/v1/apps`

### 4.4 实现约束

- 不对外继续主打 `marketplace-api.nextclaw.io`
- 底层实现可以继续复用现有 `workers/marketplace-api`
- 本轮允许通过新增域名路由或 CNAME，把现有 worker 作为 `apps-registry.nextclaw.io` 的承载端

## 5. 用户角色

### 5.1 App 开发者

目标：

- 创建 app
- 本地调试
- 一条命令发布
- 拿到稳定的 app 详情页与安装命令

### 5.2 App 使用者

目标：

- 浏览可用 app
- 判断 app 的作用、作者、版本、权限
- 复制安装命令
- 在本地安装并运行

### 5.3 官方运营者

目标：

- 维护官方 registry
- 发布官方示例 apps
- 提供默认安装入口与默认 registry

## 6. 本轮范围

本轮完成以下 6 个交付物，缺一不可。

### 6.1 `napp publish`

在 `@nextclaw/app-runtime` 中新增命令：

```bash
napp publish <app-dir> [--meta <path>] [--api-base <url>] [--token <token>] [--json]
```

能力要求：

- 读取 app 目录
- 校验 `manifest.json`
- 读取 `marketplace.json`
- 自动生成 `.napp` bundle
- 计算 bundle sha256
- 调用官方 publish API
- 返回 app id、slug、version、详情页地址、安装命令

发布身份与 scope 规则冻结：

- `napp publish` 的身份优先级固定为：
  - 显式 `--token`
  - 当前 `nextclaw login` 登录态
  - `NEXTCLAW_MARKETPLACE_ADMIN_TOKEN`
- 普通登录用户默认发布个人 scope app，`manifest.json` 中的 `appId` 必须满足 `<username>.<app-name>`
- 官方 scope 固定为 `nextclaw.<app-name>`，只允许管理员发布
- `marketplace.json.publisher` 只作为元数据输入，不作为真实发布身份来源
- 若当前平台账号没有 `username`，CLI 必须直接报错并提示先完成平台账号设置

### 6.2 官方 apps registry

在 `workers/marketplace-api` 中新增 apps 域。

能力要求：

- 提供 app 列表
- 提供 app 详情
- 提供文件查看与 README 读取
- 提供 bundle 下载
- 提供 registry metadata
- 提供 publish

补充治理入口：

- 在 `platform-console` 提供普通用户 `My Apps` 管理页
- 在 `platform-admin` 提供管理员 Apps 审核页
- apps 的 owner / review 模型与现有 Skills marketplace 对齐

### 6.3 独立 web app store

新增独立 web 应用：

```text
apps/nextclaw-apps-web/
```

能力要求：

- 首页
- app 列表页
- app 详情页
- 发布者页

### 6.4 `@nextclaw/app-sdk`

新增轻量 SDK：

```text
packages/nextclaw-app-sdk/
```

能力要求：

- 为 app 前端提供稳定 bridge client
- 不要求开发者手写 `fetch('/__napp/...')`

### 6.5 官方示例 apps

本轮必须有 3 个官方示例 app：

- `apps/examples/hello-notes`
- `apps/examples/workspace-glance`
- `apps/examples/starter-card`

### 6.6 发布与上线

本轮必须完成：

- 本地验证
- worker 部署
- web 部署
- 相关 npm 包发布
- 官方示例 apps 发布
- git 提交

## 7. 本轮明确不做

- 不接入 NextClaw 主产品 UI
- 不做主产品内嵌式 app 管理中心
- 不做评论系统
- 不做评分系统
- 不做复杂推荐系统
- 不做在线运行
- 不做通用 Docker 替代平台
- 不做复杂签名信任体系
- 不做创作者后台
- 不做复杂审核流

## 8. 核心用户流程

### 8.1 开发者发布流程

1. 开发者在本地完成 app
2. 运行 `napp inspect <app-dir>`
3. 运行 `napp publish <app-dir>`
4. CLI 自动打包并推送到官方 registry
5. CLI 返回 app id、slug、version、详情页地址与安装命令

### 8.2 用户安装流程

1. 用户打开 `apps.nextclaw.io`
2. 进入 app 详情页
3. 查看简介、作者、版本、权限、README
4. 复制安装命令
5. 在本地运行 `napp install <app-id>`
6. 安装完成后运行 `napp run <app-id>`

## 9. 功能需求冻结

## 9.1 CLI 产品需求

CLI 本轮必须具备：

- `napp publish`
- 对 `marketplace.json` 的读取与校验
- 默认发布到官方 apps API
- 默认从 `apps-registry.nextclaw.io` 安装与更新
- 默认优先复用当前 `nextclaw login` 登录态完成个人发布

CLI 本轮不做：

- 交互式发布向导
- 多 registry 配置管理中心
- 本地登录态管理系统

## 9.2 Registry API 产品需求

本轮接口冻结为：

- `GET /api/v1/apps/items`
- `GET /api/v1/apps/items/:selector`
- `GET /api/v1/apps/items/:selector/files`
- `GET /api/v1/apps/items/:selector/files/blob?path=<relative-path>`
- `GET /api/v1/apps/items/:selector/bundles/:version`
- `GET /api/v1/apps/registry/:appId`
- `POST /api/v1/apps/publish`

接口说明：

- `selector` 支持 `slug` 或 `appId`
- `publish` 使用 Bearer token 鉴权
- `registry` 返回 npm 风格版本元数据，供 `napp install` 与 `napp update` 直接使用
- 个人发布使用平台用户身份，审核前默认进入 `pending`
- 管理员可在后台将 app 审核为 `published` 或 `rejected`

## 9.3 Web App Store 产品需求

### 首页

必须包含：

- `NextClaw Apps` 一句话定义
- 官方精选 apps
- 安装说明
- 开发者入口

### 列表页

必须包含：

- 搜索
- tag 过滤
- app 卡片列表
- 安装命令入口

### 详情页

必须包含：

- 名称
- summary
- description
- app id
- 最新版本
- 作者
- publisher
- 权限摘要
- README 内容
- 安装命令

### 发布者页

必须包含：

- 发布者名称
- 该发布者名下 app 列表

## 9.4 SDK 产品需求

SDK 第一版只做浏览器端 bridge client。

API 冻结为：

```ts
createNappClient(baseUrl?)
client.health()
client.getManifest()
client.getPermissions()
client.runAction(action)
```

本轮不做：

- React hooks
- 状态管理封装
- 组件库

## 9.5 示例 apps 产品需求

每个官方示例 app 都必须具备：

- `manifest.json`
- `marketplace.json`
- `README.md`
- 可被 `pack / publish / install / run`

## 10. 数据契约冻结

### 10.1 app marketplace 元数据文件

每个 app 目录必须包含：

```text
marketplace.json
```

本轮最小结构冻结为：

```json
{
  "slug": "hello-notes",
  "summary": "Summarize an authorized notes directory in a tiny local app.",
  "summaryI18n": {
    "en": "Summarize an authorized notes directory in a tiny local app.",
    "zh": "通过一个轻量本地 app 汇总已授权的 notes 目录。"
  },
  "description": "A small NextClaw app that reads a granted notes directory and returns a compact summary through the local host bridge.",
  "descriptionI18n": {
    "en": "A small NextClaw app that reads a granted notes directory and returns a compact summary through the local host bridge.",
    "zh": "一个小型 NextClaw app，通过本地宿主桥接读取已授权 notes 目录并返回简洁摘要。"
  },
  "author": "NextClaw",
  "tags": ["notes", "documents", "local", "official"],
  "sourceRepo": "https://github.com/Peiiii/nextclaw",
  "homepage": "https://github.com/Peiiii/nextclaw",
  "featured": true,
  "publisher": {
    "id": "nextclaw",
    "name": "NextClaw",
    "url": "https://nextclaw.io"
  }
}
```

## 10.2 仓库落点冻结

本轮代码落点冻结为：

```text
packages/nextclaw-app-runtime/
packages/nextclaw-app-sdk/
apps/nextclaw-apps-web/
apps/examples/
workers/marketplace-api/
```

说明：

- runtime 继续扩展，不迁移位置
- app-sdk 作为独立 package 存在
- apps web 作为独立 web 应用存在
- 示例 apps 继续放在 `apps/examples/`
- apps registry 继续复用现有 marketplace worker

## 11. 交付物冻结

本轮最终交付物固定为：

1. 一个更新后的 `@nextclaw/app-runtime`
2. 一个新的 `@nextclaw/app-sdk`
3. 一个扩展了 apps 域的 `marketplace-api` worker
4. 一个独立的 `apps.nextclaw.io` web app store
5. 三个官方示例 apps
6. 一份本轮迭代记录
7. 一次真实的发布、部署与上线结果

## 12. 验收标准

只有同时满足下面所有条件，本轮才算完成。

### 12.1 CLI 验收

- `napp publish <app-dir>` 可用
- `napp install <app-id>` 可从官方 registry 安装
- `napp update <app-id>` 可从官方 registry 更新

### 12.2 API 验收

下面接口远端可访问：

- `/api/v1/apps/items`
- `/api/v1/apps/items/:selector`
- `/api/v1/apps/registry/:appId`
- `/api/v1/apps/items/:selector/bundles/:version`

### 12.3 Web 验收

独立 web app 可访问，且可：

- 打开首页
- 打开列表页
- 打开详情页
- 正常读取线上 apps API

### 12.4 内容验收

- 至少 3 个官方 app 条目在线可见

### 12.5 发布验收

- 相关 npm 包已正式发布
- worker 已部署
- web 已部署
- 官方示例 apps 已发布
- 代码已提交

## 13. 执行结论

这份 PRD 已经把本轮的产品定义、域名、入口、范围、接口、交付物与验收条件全部冻结。

接下来直接按这份 PRD 实现，不再回到“要不要这样做”“域名怎么起”“这一轮范围是什么”这类开放讨论。
