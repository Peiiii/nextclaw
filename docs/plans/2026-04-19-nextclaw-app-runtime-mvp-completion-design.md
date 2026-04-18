# NextClaw App Runtime 相对完善 MVP 一次性收尾方案

## 这份文档解决什么问题

这份文档只回答一个问题：

**在已经具备 `create / inspect / run / dev / pack / install / uninstall / list / info` 的前提下，`@nextclaw/app-runtime` 还要补哪些能力，才能从“本地闭环原型”推进到“相对完善、可分享、可安装、可更新、可管理”的 MVP。**

这里的目标不是做完整 app store，不是做最终安全体系，也不是把微应用直接接进 NextClaw 主产品，而是先把独立 runtime/CLI 这条线真正做成一个完整产品。

## 产品对齐

这次收尾仍然服务于 NextClaw 的长期愿景：

- 它不是在堆一个孤立功能点，而是在补一条可扩展生态主线
- 它强调“统一入口 + 能力编排 + 生态扩展”，而不是重新发明 Docker 或做一个重量级平台
- 它追求的是普通用户和普通开发者都能真正跑通“开发 -> 分享 -> 安装 -> 使用”的路径

换句话说，这次不是继续讨论 Wasm 是否足够理想，而是先把“微应用作为一种真实可分发产品形态”建立起来。

## 已有能力，不再重做

下面这些已经成立，本轮不重复建设：

- 独立 npm 包：`@nextclaw/app-runtime`
- 独立 CLI：`napp`
- 本地目录 contract：`manifest.json + main/ + ui/ + assets/`
- 本地运行链路：`create / inspect / run / dev`
- bundle 与本地安装链路：`pack / install / uninstall / list / info`
- 安装目录、数据目录、本地 registry 的基本结构

因此本轮的关键不是“再做一遍 runtime”，而是把剩余缺口收敛到清晰的产品闭环。

## 这轮一次性补齐的 MVP 范围

这次冻结为一次性完成下面 5 类能力：

1. **registry 分发能力**
2. **远端安装与更新能力**
3. **显式权限管理能力**
4. **来源与完整性可见性**
5. **可理解的 CLI 诊断体验**

## 冻结结论 1：install/update 只允许三种显式来源

为了避免行为不可预测，`napp install` / `napp update` 只允许下面三种来源：

1. 本地 app 目录
2. 本地 `.napp` bundle
3. registry app spec：`<app-id>` 或 `<app-id>@<version>`

这意味着：

- 不做“像路径、又像 app id、又像 URL”的模糊识别
- 不做隐藏 fallback
- 不做依赖当前 `cwd` 的奇怪推断

CLI 的主路径必须让用户一眼看懂自己是在安装“本地内容”还是“registry 包”。

## 冻结结论 2：registry 采用 npm 风格 base URL + app metadata 文档

registry 方案不发明新概念，直接借鉴 npm 的核心形态：

- 用户配置的是一个 **base registry URL**
- 安装时按 `app-id` 拉取一个 **metadata 文档**
- metadata 文档内部声明：
  - `dist-tags.latest`
  - `versions`
  - 每个版本的 bundle URL 与 SHA-256
  - 发布者信息

MVP 期 registry metadata 最小形态冻结为：

```json
{
  "name": "nextclaw.hello-notes",
  "description": "A tiny micro app.",
  "dist-tags": {
    "latest": "0.2.0"
  },
  "versions": {
    "0.1.0": {
      "name": "nextclaw.hello-notes",
      "version": "0.1.0",
      "description": "A tiny micro app.",
      "publisher": {
        "id": "nextclaw",
        "name": "NextClaw Official",
        "url": "https://nextclaw.com"
      },
      "dist": {
        "bundle": "./nextclaw.hello-notes/-/nextclaw.hello-notes-0.1.0.napp",
        "sha256": "<sha256>"
      }
    }
  }
}
```

这里不要求 registry 一开始就有复杂后端。它完全可以是一个静态托管的 metadata + bundle 站点。

## 冻结结论 3：runtime 提供默认 registry，同时支持自定义 registry

MVP 必须支持：

- 一个默认 registry
- 用户显式切换到自定义 registry

配置形态冻结为：

```text
~/.nextclaw/apps/config.json
```

最小结构：

```json
{
  "schemaVersion": 1,
  "registry": {
    "url": "https://registry.nextclaw.com/"
  }
}
```

CLI 侧补齐：

- `napp registry`
- `napp registry get`
- `napp registry set <url>`
- `napp registry reset`

同时允许命令级显式覆盖：

- `napp install <app-id> --registry <url>`
- `napp update <app-id> --registry <url>`

## 冻结结论 4：update 是 MVP 必做项

只有 install 没有 update，不足以构成“真正可用”的应用分发形态。

因此本轮必须补：

- `napp update <app-id>`
- `napp update <app-id> --version <version>`

行为冻结为：

1. 已安装 app 必须有可用的 registry 来源，或显式给出 `--registry`
2. 默认解析 registry `latest`
3. 如果已是目标版本，则返回“已最新”，而不是重复安装
4. 如果发现新版本，则安装新版本并切换 `activeVersion`

MVP 期先不做复杂版本通道、回滚和灰度，但要把基础升级闭环做完整。

## 冻结结论 5：权限管理必须显式可见、可改、可撤销

仅靠 `run --document` 传参，不足以支撑普通用户长期使用已安装应用。

因此本轮必须补：

- `napp permissions <app-id>`
- `napp grant <app-id> --document <scope>=<path>`
- `napp revoke <app-id> --document <scope>`

权限管理的原则是：

- requested permissions 来自 manifest，是静态 contract
- granted permissions 来自本地 registry，是用户授权状态
- `run <app-id>` 可以复用已保存 grant
- 缺少 grant 时必须给出明确提示，告诉用户执行哪条命令，而不是只报一个抽象错误

## 冻结结论 6：来源与完整性必须可见，但不做终极签名体系

这轮不把“安全”当唯一主题，但不能让来源和完整性完全不可见。

因此 MVP 期冻结为：

- registry 安装必须验证 bundle `sha256`
- 已安装版本要记录：
  - 来源类型
  - registry URL
  - bundle URL
  - publisher
  - sha256

这些信息要在 `napp info` 里可见。

这轮仍然不做：

- 公钥签名体系
- 信任链 UI
- 权限弹窗界面

因为这些会把 MVP 拖入更重的平台建设。

## 冻结结论 7：错误提示必须面向“可执行下一步”

MVP 期的 CLI 错误不追求花哨，但要做到：

- 缺参数时说清缺什么
- registry 拉取失败时说清是 metadata 失败还是 bundle 下载失败
- 校验失败时说清是哪个文件或哪个 checksum 不匹配
- 缺权限时给出对应 `grant` 命令提示

原则是：**错误信息要帮助用户立刻继续操作，而不是只让开发者读源码。**

## 本轮新增命令面

冻结后的 CLI 命令面如下：

```text
napp install <app-dir|bundle.napp|app-id[@version]> [--registry <url>] [--json]
napp update <app-id> [--version <version>] [--registry <url>] [--json]
napp registry [get] [--json]
napp registry set <url> [--json]
napp registry reset [--json]
napp permissions <app-id> [--json]
napp grant <app-id> --document <scope>=<path> [--json]
napp revoke <app-id> --document <scope> [--json]
```

现有命令继续保留。

## 目录落点冻结

新增代码继续维持 role-first 落点：

- `registry/`
  - registry config
  - remote registry client
  - remote registry types
- `install/`
  - install / update 主流程
  - install types
- `permissions/`
  - requested/granted 权限解析
  - grant / revoke / summary
- `commands/`
  - 对应 CLI controller

不新增：

- `logic/`
- `helpers/`
- `misc/`
- `marketplace/`

因为这轮仍然是在做 runtime/CLI，不是在做平台前后端。

## 验证冻结

这轮必须补齐三层验证：

1. 单元测试
   - registry config
   - remote registry install
   - update
   - grant/revoke
2. smoke
   - 本地 create -> pack -> install
   - 本地 registry 配置
   - mock registry install -> update
   - permissions grant/revoke -> run
3. 文档
   - README 更新
   - 迭代 README 更新
   - release / changeset 状态更新

## 明确不做的内容

为了让这轮真正收尾，下面这些明确不在当前 MVP 范围内：

- 图形化 app store
- 主产品内嵌入口
- 发布者登录、token、publish API
- 终极签名体系
- 自动权限弹窗
- 复杂搜索与推荐系统
- OCI / Docker / 通用容器兼容

这些不是被忽略，而是被明确排除，避免把“相对完善 MVP”拖成一个永远收不住的平台工程。

## 最终判断

这轮完成后，`@nextclaw/app-runtime` 的定位将从：

- “独立 runtime 原型”

推进为：

- “可开发、可打包、可分发、可安装、可更新、可授权、可管理的微应用 CLI/runtime MVP”

这已经足够支撑下一步去做：

- 官方默认 registry
- 官方 app 列表与文档
- 与主产品的集成

但在此之前，不需要再回头重做 runtime 形态本身。
