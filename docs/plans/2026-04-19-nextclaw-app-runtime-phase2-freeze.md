# NextClaw App Runtime 第二阶段收尾冻结稿

## 这份文档的作用

这份文档只回答一个问题：

**在已经有 `napp create / inspect / run / dev` 的前提下，第二阶段要一次性补齐哪些剩余能力，才能把 NextClaw 微应用从“能开发、能跑”推进到“能打包、能安装、能管理、能分享”。**

这不是第一阶段回顾，也不是开放式 brainstorming 文档。它是第二阶段的收尾冻结稿，后续实现默认以这里的结论为准。

相关文档：

- [NextClaw Wasm Apps 方案冻结稿](./2026-04-18-nextclaw-wasm-apps-freeze.md)
- [NextClaw App Runtime 目录结构设计](./2026-04-18-nextclaw-app-runtime-structure-design.md)
- [NextClaw App 分发与安装闭环设计稿](./2026-04-19-nextclaw-app-distribution-closure-design.md)

## 先明确：当前不缺什么

下面这些已经有了，第二阶段不再重复建设：

- 独立 npm 包：`@nextclaw/app-runtime`
- 独立 CLI：`napp`
- 开发入口：`napp create / inspect / run / dev`
- 目录式 app contract：`manifest.json + main/ + ui/ + assets/`
- 最小权限模型：`documentAccess / allowedDomains / storage / capabilities`
- 本地宿主与桥接链路
- 示例 app 与 smoke 闭环

一句话说：**runtime 已经成立，第二阶段只做“分发、安装、管理”这层。**

## 第二阶段一次性要补齐的能力

第二阶段冻结为一次性完成下面 6 件事：

1. `napp pack`
2. `napp install`
3. `napp uninstall`
4. `napp list`
5. `napp info`
6. 安装态 app 的 `napp run <app-id>`

配套新增两块基础设施：

- `.napp` bundle
- 本地 app registry

## 冻结结论 1：应用的三种形态分开

一个 NextClaw 微应用必须同时存在三种不同形态：

1. **源形态**：开发者编辑的目录
2. **分发形态**：`.napp` bundle
3. **运行形态**：安装后解包到本机的目录

第二阶段不改变第一阶段的目录 contract；只是补上源形态到分发形态、再到运行形态之间的产品闭环。

## 冻结结论 2：`.napp` 是分发包，不是执行包

`.napp` 的职责是：

- 交付
- 校验
- 安装
- 分享

`.napp` 不是：

- 直接执行形态
- 新的运行时 contract
- 另一种独立于目录 contract 的 app 结构

运行时继续围绕目录工作；包只负责运输。

## 冻结结论 3：`.napp` 扩展名保留，底层格式直接复用 zip

第二阶段不发明新的底层容器格式。

冻结方案：

- 产品名：`NextClaw App Bundle`
- 文件扩展名：`.napp`
- 物理格式：`zip`

这样做的好处是：

- 用户侧有明确的 app 包概念
- 技术侧不用自造压缩格式
- 打包、解包和跨平台支持都更简单

## 冻结结论 4：`.napp` 内部结构

第二阶段 `.napp` 内部结构冻结为：

```text
manifest.json
main/
ui/
assets/
.napp/
  bundle.json
  checksums.json
```

说明：

- app 自身目录 contract 仍然维持在根目录
- bundle 自身的分发层元数据单独放在 `.napp/`
- 第二阶段不强制引入签名文件，但预留未来增加 `.napp/signature.json` 的空间

## 冻结结论 5：`bundle.json` 只描述分发层，不替代 manifest

`manifest.json` 仍然是 app contract 的唯一来源。

`bundle.json` 只负责描述分发层本身，最小字段冻结为：

```json
{
  "bundleFormatVersion": 1,
  "appId": "nextclaw.starter",
  "name": "Starter",
  "version": "0.1.0",
  "entryManifest": "manifest.json",
  "checksumsFile": ".napp/checksums.json"
}
```

第二阶段不把应用权限、主入口、UI 入口之类字段重复拷进 `bundle.json`。

## 冻结结论 6：`checksums.json` 是第二阶段必做项

第二阶段必须做完整性校验，但不把终极签名体系一起带进来。

因此：

- `checksums.json`：必做
- `signature.json`：预留，不强制

`checksums.json` 冻结为 SHA-256 摘要表，至少覆盖：

- `manifest.json`
- `main/` 下全部文件
- `ui/` 下全部文件
- `assets/` 下全部文件
- `.napp/bundle.json`

## 冻结结论 7：打包前必须先 inspect

`napp pack <app-dir>` 的主路径冻结为：

1. 读取目录
2. 执行与 `inspect` 等价的校验
3. 生成 `.napp/bundle.json`
4. 生成 `.napp/checksums.json`
5. 输出 `.napp` 文件

如果 `inspect` 不通过，`pack` 必须失败，不允许打出“不确定是否可运行”的 bundle。

## 冻结结论 8：本地安装目录与用户数据目录必须分离

第二阶段安装目录冻结为：

```text
~/.nextclaw/apps/
  packages/
    <app-id>/
      <version>/
        manifest.json
        main/
        ui/
        assets/
        .napp/
  data/
    <app-id>/
```

设计原则：

- app 代码目录和用户数据目录必须分开
- 卸载代码默认不删数据
- 后续升级、版本切换、数据保留都会更清晰

## 冻结结论 9：本地 registry 先用 JSON，不上数据库

第二阶段不引入数据库。

registry 冻结为一个明确的 JSON 文件：

```text
~/.nextclaw/apps/registry.json
```

最小结构冻结为：

```json
{
  "schemaVersion": 1,
  "apps": {
    "nextclaw.starter": {
      "appId": "nextclaw.starter",
      "name": "Starter",
      "activeVersion": "0.1.0",
      "dataDirectory": "/Users/me/.nextclaw/apps/data/nextclaw.starter",
      "installedVersions": {
        "0.1.0": {
          "version": "0.1.0",
          "installDirectory": "/Users/me/.nextclaw/apps/packages/nextclaw.starter/0.1.0",
          "sourceKind": "bundle",
          "sourceRef": "/path/to/starter.napp",
          "installedAt": "2026-04-19T00:00:00.000Z"
        }
      },
      "grants": {
        "notes": "/Users/me/Notes"
      }
    }
  }
}
```

第二阶段先记录：

- 基本元信息
- 已安装版本
- 当前激活版本
- 数据目录
- 权限 grants

## 冻结结论 10：安装命令的最终行为

第二阶段 `napp install` 冻结为支持两类输入：

1. 本地 app 目录
2. 本地 `.napp` 文件

第二阶段先不把“远程 marketplace app 下载”并进 runtime CLI 主路径，避免把本地包管理和远端平台耦合到一块。

`install` 的主路径冻结为：

1. 识别输入类型
2. 如果是目录，则先临时打包/或直接校验后安装
3. 如果是 `.napp`，则先解包到临时目录
4. 校验 bundle 结构与 checksums
5. 读取 manifest
6. 写入安装目录
7. 更新 registry
8. 输出已安装 app 的摘要

## 冻结结论 11：卸载与升级语义

### 卸载

`napp uninstall <app-id>` 默认行为：

- 删除所有已安装版本的代码目录
- 删除 registry 中对应 app 记录
- 保留 `data/<app-id>/`

如果用户明确传 `--purge-data`，才删除用户数据目录。

### 升级

安装新版本时：

- 允许多版本物理共存
- registry 只激活一个 `activeVersion`
- 新安装版本默认切为 active version

## 冻结结论 12：运行命令兼容两种输入

第二阶段 `napp run` 冻结为兼容两种输入：

1. 目录路径
2. 已安装 app 的 `app-id`

运行态主路径：

- 如果输入能解析为存在的目录，则按开发态目录运行
- 否则按 `app-id` 去 registry 查当前 active version
- 解析到安装目录后，继续复用现有目录式 runtime

这条结论能最大化复用第一阶段代码，不需要再造第二套执行路径。

## 冻结结论 13：授权在运行时发生，不在安装时发生

第二阶段安装时只做：

- 展示权限摘要
- 记录 app 请求了哪些权限

第二阶段安装时不做：

- 自动授权本地目录
- 自动选择用户路径
- 静默写入 grants

目录授权仍然发生在运行时。若用户通过显式参数提供授权，例如：

```bash
napp run nextclaw.notes --document notes=/Users/me/Notes
```

则 runtime 在本次运行前完成解析，并把 grant 持久化到 registry，供下次安装态运行复用。

## 冻结结论 14：信息与列表命令的职责

### `napp list`

展示本机已安装 app 的列表，至少包含：

- `appId`
- `name`
- `activeVersion`

### `napp info <app-id>`

展示指定 app 的详情，至少包含：

- 基本元信息
- 已安装版本
- active version
- 安装目录
- 数据目录
- 权限摘要
- 已保存 grants

## 冻结结论 15：第二阶段明确不做的事

为了保证一次性实现仍然可控，下面这些明确不并入第二阶段：

- 直接运行 `.napp` 包本体
- app marketplace 后端
- app 搜索/评分/评论/推荐系统
- 终极签名体系
- GUI app store
- 任意 URL 下载执行
- OCI / 容器格式

这不是否定这些能力，而是明确它们不属于这次“runtime 第二阶段收尾”。

## 第二阶段最终命令面

第二阶段冻结后的 CLI 命令面如下：

```text
napp create <app-dir>
napp inspect <app-dir>
napp dev <app-dir>
napp run <app-dir|app-id>
napp pack <app-dir> [--out file.napp]
napp install <app-dir|bundle.napp>
napp uninstall <app-id> [--purge-data]
napp list
napp info <app-id>
```

这就是第二阶段的收尾范围，不再继续扩命令面。

## 代码结构的 owner 划分

为了保证实现可维护，第二阶段新增逻辑的 owner 边界冻结为：

```text
src/
  bundle/
    app-bundle.types.ts
    app-bundle.service.ts
  install/
    app-installer.service.ts
    app-installation.types.ts
  registry/
    app-registry.types.ts
    app-registry.service.ts
  paths/
    app-home.service.ts
  commands/
    pack.controller.ts
    install.controller.ts
    uninstall.controller.ts
    list.controller.ts
    info.controller.ts
```

职责说明：

- `bundle/`：只负责 pack/unpack、bundle 元数据与 checksum
- `install/`：只负责安装、卸载、激活版本切换
- `registry/`：只负责 registry 读写和记录结构
- `paths/`：只负责本地目录定位
- `commands/`：只负责 CLI 入参与输出

不允许把这些逻辑重新糊回 `main.ts` 或某个大而全的 service。

## 最小可信验证

第二阶段实现完成后，至少要覆盖下面这些真实验证：

1. `napp create -> napp pack`
2. `napp install <bundle>`
3. `napp list`
4. `napp info <app-id>`
5. `napp run <app-id>`
6. `napp uninstall <app-id>`
7. `napp uninstall <app-id> --purge-data`
8. checksum 失败时安装必须失败

只有这条完整链路成立，第二阶段才算真正完成。
