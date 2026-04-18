# NextClaw Apps 生态与独立 Marketplace / App Store 设计稿

## 这份文档解决什么问题

这份文档只回答当前阶段最关键的一个问题：

**在 `@nextclaw/app-runtime` 的独立 CLI/runtime MVP 已经成立之后，`NextClaw Apps` 接下来还缺什么，以及最合理的下一步产品化路径是什么。**

这里不再重复讨论第一阶段的应用模型、目录 contract、bundle 格式或基础安装命令，而是向前推进到真正会影响生态能否成立的几层：

1. 开发者如何发布 app
2. 用户如何发现、安装、更新 app
3. 官方 registry 和 marketplace 应该如何分层
4. marketplace / app store 是否应该先做成独立 web 应用
5. 下一阶段应该一次性补哪些能力，才能让 `NextClaw Apps` 从“技术可行”进入“产品可成立”

相关已存在文档：

- [NextClaw Wasm Apps 方案冻结稿](./2026-04-18-nextclaw-wasm-apps-freeze.md)
- [NextClaw App Runtime 目录结构设计](./2026-04-18-nextclaw-app-runtime-structure-design.md)
- [NextClaw App 分发与安装闭环设计稿](./2026-04-19-nextclaw-app-distribution-closure-design.md)
- [NextClaw App Runtime 第二阶段收尾冻结稿](./2026-04-19-nextclaw-app-runtime-phase2-freeze.md)
- [NextClaw App Runtime 相对完善 MVP 一次性收尾方案](./2026-04-19-nextclaw-app-runtime-mvp-completion-design.md)

## 当前已经成立，不再重复建设

基于当前仓库、已发布 npm 包、已发布官方 skill 和已完成 smoke 闭环，下面这些已经成立：

- 独立 npm 包：`@nextclaw/app-runtime`
- 独立 CLI：`napp`
- 基础开发工作流：`create / inspect / run / dev / pack`
- 基础分发与安装工作流：`install / update / uninstall / list / info`
- 本地 registry 与本地权限管理：`registry / permissions / grant / revoke`
- `.napp` bundle 作为分发包
- 目录式 app contract：`manifest.json + main/ + ui/ + assets/`
- 默认 registry + 自定义 registry 的 CLI 能力
- 最小示例 app 与最小 marketplace skill

一句话说：

**现在已经不缺“runtime 能不能跑”，当前真正缺的是“app 生态能不能形成使用闭环”。**

## 当前真正还缺什么

如果只看剩余缺口，当前核心只剩下面六类：

### 1. 缺开发者发布链路

现在开发者可以：

- 创建 app
- 本地运行 app
- 打包 app
- 本地安装或从 registry 安装 app

但开发者还没有一个真正顺手、稳定、面向产品发布的官方链路，把“本地 app 目录”推到“别人可以安装的官方或自定义 registry”里。

这意味着生态还没形成真正的：

`开发 -> 打包 -> 发布 -> 被别人发现 -> 被别人安装`

### 2. 缺官方默认 registry 的真实落地

当前 runtime 已经支持默认 registry 配置，但“协议存在”和“官方 registry 真正可用”不是一回事。

还缺：

- 官方默认 registry 服务本身
- 稳定的 metadata 与 bundle 托管
- 官方 app 的发布入口
- 真实可安装的官方 app 内容

### 3. 缺 app marketplace / app store 产品层

registry 只解决“如何拉包、如何升级”，它不解决：

- app 展示
- app 发现
- app 分类
- app 权限说明
- app 信任展示
- app 安装引导

也就是说，**registry 不是 marketplace，marketplace 也不是 runtime。**

### 4. 缺稳定的 app SDK / bridge 开发接口

现在 UI 侧通过 `__napp` bridge 调宿主已经能跑，但开发者心智还不够稳定：

- 什么能力属于 UI
- 什么能力属于宿主
- 什么能力属于 `main`
- UI 如何安全调用宿主动作
- 错误返回结构是什么
- 权限缺失时应该拿到什么错误

如果不把这层固化成 SDK，后面每个 app 都会重复猜一遍 contract。

### 5. 缺足够有说服力的官方 app 内容

只有 runtime 和一个 starter app，还不足以让人相信这是一个真实生态。

还缺：

- 3 到 5 个质量过关的官方示例 app
- 这些 app 覆盖不同使用模式
- 它们真的走完整的发布、安装、更新链路

### 6. 缺面向普通用户的发现与信任体验

当前 CLI 已经能做很多事，但普通用户要用别人做的 app，还会遇到几个现实问题：

- 我去哪里找 app
- 我怎么知道这个 app 是谁发的
- 它会申请哪些权限
- 我安装前能看到什么
- 更新后变了什么
- 哪些 app 是官方的，哪些是社区的

这不是“安全产品”的额外加分项，而是 app 生态成立的基本门槛。

## 先给结论：下一阶段不应再以 runtime 底层为主，而应以生态闭环为主

当前有三条可能路线：

### 路线 A：继续深挖 runtime 底层

例如：

- 更强 Wasm 隔离
- Wasmtime sidecar 正式化
- 更多 capability
- 更复杂的本地执行模型

优点：

- 技术底座更强

问题：

- 很容易持续加重
- 会把阶段目标重新拉回基础设施
- 对“生态能不能起盘”的帮助没有那么直接

### 路线 B：优先补齐生态闭环

也就是：

- 官方 registry
- 开发者发布链路
- 独立 marketplace / app store
- app SDK
- 官方示例 app
- 文档与体验

优点：

- 最符合 NextClaw “统一入口 + 能力编排 + 生态扩展”的长期方向
- 最能把现有 runtime 变成真实产品
- 最容易形成“开发 -> 分享 -> 安装 -> 使用 -> 更新”的闭环

问题：

- 会开始进入产品层和运营层

### 路线 C：现在就接进主产品

例如：

- 内嵌到 NextClaw UI
- 做主产品内的 app 列表页
- 做宿主内 app 管理页

优点：

- 统一感更强

问题：

- 太早把 runtime 和主产品耦合
- 会放大当前尚未完全固化的边界
- 会让“生态层”和“主产品接入层”混在一起

## 当前推荐路线

**明确推荐路线 B。**

也就是：

**下一阶段应当优先把 `NextClaw Apps` 做成一个独立成立的 app 生态闭环，而不是继续深挖 runtime 底层，也不是现在就急着接入主产品。**

## 对“独立 web marketplace / app store”的判断

### 结论

**我支持，而且这是当前最佳选择。**

推荐先把它做成独立 web 应用，部署到类似下面的地址：

- `apps.nextclaw.io`
- 或 `store.nextclaw.io`
- 或 `marketplace.nextclaw.io/apps`

当前最推荐的是：

**`apps.nextclaw.io` 作为独立 web app。**

### 为什么推荐独立 web 应用，而不是先内嵌进 NextClaw

因为当前阶段我们的目标不是“把 app 入口塞回主产品”，而是先让这套形态自己成立。

独立 web app 有几个明显好处：

#### 1. 边界更清楚

它和 runtime 的关系会更明确：

- runtime 负责运行与安装
- registry 负责分发
- marketplace 负责发现与展示

不会一上来就和主产品 UI 混成一个巨大的耦合体。

#### 2. 更利于传播和分享

如果用户要把某个 app 发给别人，一个公开可访问的 web 页面远比“先装主产品再找入口”更自然。

这更符合你前面一直强调的目标：

**让 AI web coding 做出来的小应用真的能传播、复制、被别人使用。**

#### 3. 更适合做公开生态入口

独立 web 应用更容易承接：

- SEO
- 分类页
- 专题页
- 官方推荐
- 分享链接
- 安装引导

这些能力天然更像一个公开生态入口，而不是主产品内部的二级页面。

#### 4. 更利于先把产品形态做对

如果一开始就内嵌到主产品，我们会很容易被已有 UI、已有导航、已有状态体系绑住。

独立 web app 让我们先把这些更重要的问题做对：

- 用户第一次看到 app store 时看到什么
- 一个 app 详情页应该展示什么
- 安装链路怎么表达最清楚
- 权限、作者、版本、来源如何展示

#### 5. 后续仍然可以内嵌

独立 web app 并不排斥未来再内嵌。

只要 marketplace 后端和页面 contract 设计干净，后面完全可以：

- 主产品内嵌一个简化版列表
- 打开外部 `apps.nextclaw.io` 详情页
- 或主产品内直接复用同一套 API / UI 组件

也就是说：

**先独立，不等于永远割裂。**

## registry 与 marketplace 的分层结论

这是下一阶段必须冻结清楚的一个概念，否则后面会一直混。

### registry 是什么

registry 解决的是：

- app metadata
- bundle 下载
- 版本分发
- checksum 校验
- install / update 的机器可读协议

它本质上更像：

- npm registry
- package registry

### marketplace 是什么

marketplace 解决的是：

- app 展示
- app 搜索
- app 分类
- app 详情页
- 权限说明
- 作者与来源展示
- 安装引导
- 官方推荐与审核态表达

它本质上更像：

- app store 的产品层

### 推荐关系

推荐采用：

**`registry` 作为分发协议层，`marketplace` 作为面向人的产品层。**

不要把两者混成一个大而模糊的“平台”。

## 下一阶段建议冻结的整体结构

下一阶段推荐冻结为下面五个组成部分：

### 1. `@nextclaw/app-runtime`

继续作为独立 npm 包和 CLI。

职责：

- 本地开发
- 本地运行
- 打包
- 安装
- 更新
- 权限管理
- 发布命令入口

### 2. `@nextclaw/app-sdk`

新增一个轻量 SDK 包。

职责：

- UI 调宿主 bridge 的类型安全封装
- 标准错误结构
- 标准 action 调用封装
- 权限缺失错误与提示结构
- 后续 host API 的稳定客户端入口

它的目标不是“做重型框架”，而是：

**让 app 作者不用直接手写 `fetch('/__napp/...')`。**

### 3. 官方 app registry

作为分发协议层。

职责：

- 存储 app metadata
- 存储 bundle
- 提供 install / update 所需 API
- 提供版本与校验信息

第一版完全可以很克制：

- metadata 可以是简单 API 或静态 JSON
- bundle 可以直接挂在对象存储
- 不必先做复杂后台

### 4. 独立 web marketplace / app store

部署在 `apps.nextclaw.io`。

职责：

- 公开展示 app
- 分类与搜索
- 详情页
- 权限与版本展示
- 安装引导
- 官方与社区标识

### 5. 官方 app 内容与发布管线

职责：

- 官方 app 样例
- 开发者发布链路
- 审核与官方推荐的最小流程

## 对 marketplace / app store 产品形态的推荐

### 产品定义

第一版不必纠结“到底叫 marketplace 还是 app store”。

更合理的理解是：

- 对内它是 `NextClaw Apps Marketplace`
- 对外它可以表现得更像 `App Store`

也就是：

- 架构上用 `marketplace` 这个词更准确
- 产品表达上可以更接近 `Apps`

### 第一版页面建议

第一版独立 web app 只需要下面几类页面：

1. 首页
2. 分类/搜索页
3. app 详情页
4. 发布者页
5. 官方 app 集合页

当前不急着做：

- 复杂评论系统
- 星级评分系统
- 社交 feed
- 在线运行沙盒
- 复杂后台管理台

### 首页应该解决什么

首页不是堆卡片，而是要回答三个问题：

1. `NextClaw Apps` 是什么
2. 我可以装什么
3. 我怎么开始

所以首页应该至少有：

- 一段很短的产品解释
- 官方精选 app
- 常见分类
- 安装方式说明
- 对开发者的入口

### app 详情页应该展示什么

一个 app 详情页至少应该展示：

- app 名称
- 简介
- 图标
- 作者 / 发布者
- 官方或社区标识
- 当前版本
- 更新时间
- 权限摘要
- 版本历史入口
- 安装命令
- 使用说明
- 截图或演示图

如果信息不足，普通用户根本不敢装。

## 对安装体验的建议

独立 web marketplace 第一版不需要强求“浏览器里一键装上”。

更现实的第一版路径是：

- 页面展示明确的 CLI 安装命令
- 支持复制命令
- 支持“复制 app id”
- 后续再补深链接能力

例如详情页上明确展示：

```bash
napp install nextclaw.hello-notes
```

如果后面主产品或桌面端支持 URI scheme，再补：

- `nextclaw://apps/install/<app-id>`

但这不是第一版前置条件。

## 对开发者发布链路的建议

### 结论

下一阶段应该正式补：

```bash
napp publish <app-dir>
```

并配套支持：

```bash
napp publish <app-dir> --registry <url>
napp publish <app-dir> --channel stable
napp publish <app-dir> --dry-run
```

### `publish` 的职责

`publish` 负责把几个步骤收成一条产品主路径：

1. inspect
2. pack
3. 生成或更新 registry metadata
4. 上传 bundle
5. 输出发布结果

这一步非常关键，因为没有它，生态作者还得自己拼很多离散动作。

### 第一版发布模型建议

第一版发布模型先克制，不做过重平台：

- 官方 app 走官方发布
- 社区 app 先支持最小发布能力
- 自定义 registry 继续保留

也就是说：

**runtime 继续支持“自定义 registry 自由发布”，官方 registry 则走更稳定的官方路径。**

## 对 SDK 的建议

下一阶段应新增 `@nextclaw/app-sdk`，但必须保持轻量。

第一版只建议包含：

- `callHostAction`
- `getManifest`
- `getGrantedPermissions`
- 标准错误类型
- 基础类型定义

不要一开始就把它做成重量级应用框架。

SDK 的作用是：

- 固化 contract
- 降低 app 作者的理解成本
- 避免 bridge 调用在每个 app 里野生生长

## 对官方 app 内容的建议

第一版至少补齐 3 到 5 个官方 app。

推荐优先选择：

1. 文件笔记 / 文档摘要类
2. 本地目录浏览 / 搜索类
3. API 查询面板类
4. 结构化小工具类
5. 只读 dashboard / viewer 类

选择标准不是“炫技”，而是：

- 真的能展示 app 形态
- 权限模型清楚
- 分享后别人真的能装
- 能覆盖不同的 UI + main 协作模式

## 对信任展示的建议

当前阶段不应把重点拉成“重安全平台”，但必须把最小信任展示做好。

第一版 marketplace / runtime 至少应可见：

- publisher
- source
- version
- checksum verified
- requested permissions
- official badge
- updated at

这里推荐原则是：

**先把“可理解、可判断、可见”做好，而不是一开始就做完整签名基础设施。**

## 对“是否现在就接主产品”的结论

### 结论

**当前不建议优先接入主产品。**

### 原因

因为我们当前缺的不是“入口藏在哪”，而是“这条生态链自己是否成立”。

如果太早接入主产品，会立刻遇到这些问题：

- 主产品导航怎么放
- 和现有 marketplace 怎么并列
- 权限 UI 放哪
- 安装成功后如何跳转
- 是否与主产品账号和状态体系耦合

这些问题当然以后都要处理，但现在不是最优先。

当前更好的顺序是：

1. 先让 `runtime + registry + publish + apps web marketplace` 这条链独立成立
2. 再决定如何把它接回 NextClaw 主产品

## 下一阶段一次性建议范围

如果我们要做一个“第二阶段全部完成”的方案，我建议范围直接冻结成下面这一包：

### A. 分发层

- 官方默认 registry 真正可用
- `napp publish`
- 发布 metadata/bundle 管线

### B. 开发层

- `@nextclaw/app-sdk`
- SDK 文档
- manifest / bridge / permissions 文档

### C. 内容层

- 3 到 5 个官方 app
- 完整示例与安装说明

### D. 产品层

- `apps.nextclaw.io` 独立 web marketplace
- 首页 / 分类页 / 详情页
- 安装命令展示
- 官方与社区展示

### E. 信任与治理层

- publisher 展示
- 权限摘要展示
- 版本与更新时间展示
- 官方审核态 / badge 的最小表达

## 当前明确不做的事

为了避免范围再次失控，下面这些继续明确不在当前阶段：

- 不先做主产品内嵌
- 不先做复杂签名信任链
- 不先做在线运行或浏览器内直接执行
- 不先做复杂评论、评分、社交互动
- 不先做复杂创作者结算或商业化
- 不先做重型 Wasm 容器平台
- 不先做“替代 Docker”的通用后端平台

## 目录与工程落点建议

下一阶段如果要开始实现，建议继续保持解耦：

### runtime 包

继续放在：

```text
packages/nextclaw-app-runtime/
```

### SDK 包

新增：

```text
packages/nextclaw-app-sdk/
```

### 独立 web marketplace

建议作为独立 app 放在：

```text
apps/nextclaw-apps-web/
```

它是一个真正要部署的 web 应用，所以应该放在 `apps/`，而不是继续塞进 `packages/`。

### 示例应用

继续放在：

```text
apps/examples/
```

## 推荐的域名分工

第一版推荐分工如下：

- `apps.nextclaw.io`
  - 独立 web marketplace / app store
- `registry.nextclaw.io`
  - app registry API / metadata / bundle 分发

这样分开有几个好处：

- 面向人和面向机器的入口清楚分层
- 后续更容易缓存、托管和演进
- 未来即使主产品内嵌，也不会把协议层和页面层混在一起

## 最终冻结结论

当前 `NextClaw Apps` 的下一阶段，不应继续以 runtime 底层扩张为主，也不应现在就优先接入主产品。

**最合理的下一步，是把它推进成一套独立成立的 app 生态闭环：**

1. `@nextclaw/app-runtime` 继续作为本地 runtime/CLI
2. 新增 `@nextclaw/app-sdk` 固化 bridge 与 host API contract
3. 落地官方默认 registry
4. 增加 `napp publish`
5. 构建独立 web marketplace / app store
6. 用 3 到 5 个官方 app 跑通完整闭环

其中，**独立 web marketplace / app store 是当前明确推荐的路线**，并且建议优先部署在 `apps.nextclaw.io` 这样的公开地址下，而不是先内嵌进 NextClaw 主产品。

这条路线最符合当前阶段的真实目标：

**不是继续证明技术可行，而是开始证明 `NextClaw Apps` 作为一种可开发、可分享、可发现、可安装、可更新的微应用形态，真的可以成立。**
