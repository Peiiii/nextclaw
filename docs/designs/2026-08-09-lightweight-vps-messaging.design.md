# NextClaw 轻量常驻与 VPS 宣传体系设计

## 背景与用户问题

NextClaw 已支持 Linux、Docker、NAS 和云服务器部署，但现有对外内容主要回答“能否部署”，没有继续回答自部署用户最关心的两个问题：

1. 空闲时会不会长期占用大量内存；
2. 需要怎样的 VPS 配置才能稳定运行。

扩展运行时按需激活已经把“已安装的渠道能力”和“必须常驻的渠道进程”分开。未启用消息渠道时不再启动十个独立 Node 进程，ARM64 Linux 受限环境的空配置三轮平均 working set 从旧版本约 865～885 MiB 降到 164.94 MiB。这个结果能够增强 VPS、NAS、家用服务器和多服务共存场景，但当前证据还不能支持“所有 VPS 固定只占 165 MiB”或“1 GiB VPS 保证可用”。

本设计把轻量常驻从内部工程结果转成一条有事实边界、可继续补证据的对外内容链路。

## 定位判断

NextClaw 的上位定位继续是“长期个人智能搭档”和个人操作层。轻量常驻不是新的品牌主定位，而是“能够低成本长期在线”的支撑优势。

对外主张按以下三层表达：

1. **用户收益**：可以把 NextClaw 留在自己的 VPS、NAS 或 Linux 设备上长期运行。
2. **可观察机制**：未启用的消息渠道不常驻独立进程，需要启用或使用时再按需启动。
3. **可复现证据**：在明确的 Linux、架构、CPU、内存限制和空载条件下公布三轮 working set、peak 与 PSS。

不把代码量、内部治理方法或实现复杂度当成主要用户价值。相比“代码量约为某产品的几分之一”，真实运行资源更接近用户的部署成本。

## 当前事实源与内容 Owner

### 事实源

- 实现与验收事实：`docs/designs/2026-08-09-on-demand-extension-runtime-lifecycle.design.md`。
- 交付摘要：`docs/logs/v0.26.80-extension-runtime-on-demand-memory/README.md`。
- 用户可见版本摘要：`.changeset/on-demand-extension-runtime.md`。

其中 ARM64 三轮数据已经通过；真实 AMD64 VPS 绝对内存矩阵仍待补齐。所有对外数字必须继承这个边界。

### 内容 Owner

- `apps/landing/src/shared/lib/landing-content/landing-comparison-content.config.ts`：官网首页差异化价值卡片。
- `apps/landing/src/main.ts`：官网安装页可见安装说明。
- `README.md` 与 `README.zh-CN.md`：GitHub 访客的自部署选择理由。
- `apps/docs/*/guide/install.md`：安装路径与当前推荐配置。
- `apps/docs/*/guide/resource-usage.md`：资源数据、测试方法、适用边界和后续更新的唯一公开证据页。
- `apps/docs/.vitepress/navigation/docs-navigation.config.ts`：资源页发现入口。
- `.changeset/on-demand-extension-runtime.md`：下一稳定版本的用户变化摘要。

官网编译产物和旧的 `website/` 静态站不作为文案事实 owner；不手工维护平行基准数据。

## 推荐内容链路

```mermaid
flowchart LR
  Home["官网：适合长期在线"] --> Install["安装页：VPS / NAS 部署选择"]
  Readme["README：轻量自部署摘要"] --> Install
  Install --> Evidence["资源占用页：环境、三轮数据、边界"]
  Release["Changeset / Release Notes：版本变化"] --> Evidence
```

### 官网首页

首页不堆基准表，只把现有“部署到自己的设备”价值卡升级为：

- 标题明确包含 VPS、NAS、Linux 和长期运行；
- 描述明确“未启用渠道不常驻、使用时按需启动”；
- 链接直接进入公开资源证据页。

### 官网安装页与 README

安装路径附近补充轻量常驻结果和证据链接。允许展示 `约 165 MiB`，但同一句或相邻句必须写明 ARM64 Linux、空配置和三轮平均，不把它写成最低配置或跨平台保证。

### 文档站

新增中英文 `resource-usage.md`，统一承载：

- 当前推荐的服务器起步配置；
- 空配置、单微信、单 Discord 三轮结果；
- working set、peak、PSS 的测量口径；
- 活跃 Agent runtime、浏览器、MCP、本地模型和更多渠道会增加内存的边界；
- AMD64 VPS 和 1 GiB VPS 尚未形成公开支持承诺。

安装页、运行与托管页、文档首页和导航只保留摘要并链接该页，不复制完整方法。

## 宣传口径不变量

1. “轻量”必须落到长期运行成本，不能只作为空泛形容词。
2. “未启用渠道不常驻”只描述消息渠道扩展，不扩大成所有 Agent runtime、MCP、浏览器或模型均不占内存。
3. `164.94 MiB` 只描述 ARM64 Linux、2 vCPU / 2 GiB 限制、空 workspace、无活跃 Agent/model 请求、健康后稳定 60 秒的三轮平均 working set。
4. 首页使用定性主张；详细数字必须链接到资源占用页。
5. 在真实 AMD64 VPS 三轮复测前，不把 ARM64 绝对值承诺给所有 VPS。
6. 在真实 1 GiB VPS 完成功能与峰值验收前，不宣传“1 GB VPS 保证可用”。
7. 没有同机、同版本、同工作负载和同测量口径的对照，不宣称比 OpenCode、OpenClaw 或其他产品更省内存。
8. 对外版本内容只描述已发布版本；当前 changeset 可以准备口径，但官网数字上线必须跟随包含按需扩展实现的稳定版本。

## 实现范围

本轮修改：

- 官网首页差异化卡片和安装页 Docker/VPS 说明；
- 官网安装页中英文 SEO description；
- 中英文 README；
- 中英文安装、运行托管和文档首页入口；
- 中英文资源占用证据页与侧栏导航；
- 现有按需扩展 changeset 的用户收益与量化摘要。

本轮不修改：

- 产品首屏主定位与英雄区标题；
- 历史博客和已经发布的旧版本说明；
- 旧 `website/` 静态实现；
- 产品运行代码、内存生命周期或 VPS 部署脚本；
- 任何生产站点部署、NPM 发布或 Git 提交。

## 验证与验收标准

### 内容验收

- 官网、README、安装页和资源页形成从主张到证据的可达链接。
- 中英文含义一致；中文自然，英文不使用无法证明的 superlative。
- 所有数字与三轮验收记录逐项一致。
- 页面明确区分空闲基线与活跃任务内存。
- 不出现“所有 VPS 只占约 165 MiB”“1 GB 保证可用”或未经同口径验证的竞品比较。

### 工程验收

- Landing TypeScript 检查、定向 lint 和生产 build 通过。
- VitePress 文档生产 build 通过，新增中英文路由和内部链接可解析。
- `git diff --check` 与新代码治理检查通过。
- 最终范围审计只包含本宣传链路文件，不混入工作区现有聊天 UI 改动。

### 后续升级条件

真实 AMD64 VPS 完成空配置、单微信、单 Discord 各三轮复测后，将同口径表格追加到公开资源页，并把首页链接附近的摘要升级为 AMD64 VPS 数字。真实 1 GiB VPS 在关闭 swap 条件下通过启动峰值、持续空载、真实聊天和单渠道收发后，才允许增加“1 GB VPS 可部署”的明确主张。
