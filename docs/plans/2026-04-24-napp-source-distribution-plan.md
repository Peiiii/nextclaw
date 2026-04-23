# NApp 轻量 Source 分发方案

## 目标

在保持 `Wasm` 作为运行时方案不变的前提下，把 NApp 的默认分发模式从“预构建 runtime bundle”切到“轻量 source archive”，让用户下载与商店分发更接近轻应用体验，同时保留现有 bundle 作为兼容模式。

一句话：

- `Wasm` 是运行形态
- `.napp` 是统一分发容器
- `.napp` 内部可区分 `source` 与 `bundle` 两种分发模式

## 原则

1. 运行合同与分发合同解耦
2. 默认分发应尽量只包含用户 payload，而不是每个应用重复携带一份运行时支持代码
3. 不推翻现有 runtime layout：运行时仍然落成 `manifest.json + main/ + ui/ + assets/`
4. 老的预构建 bundle 继续可发布、可安装、可运行

## 模式定义

### `source`

默认分发模式。

特征：

- 归档内保留用户源码、`ui/`、`assets/`、`manifest.json`、构建配置、锁文件等
- 对 `wasi-http-component` 应用，`main/app.wasm` 在 source 归档中只保留一个占位物，而不是上传真实大 wasm
- 安装时由 NextClaw 在本地物化并构建，生成真正可运行的 `main/app.wasm`

### `bundle`

兼容模式。

特征：

- 归档内直接包含最终运行时文件
- 安装时无需再构建
- 适合离线、可复现、调试固定产物、或高级用户明确要求预构建场景

## 统一分发容器

继续使用 `.napp` 作为统一容器，不新增第二种文件后缀。

区别放在 `.napp/bundle.json` 中的 `distributionMode`：

- `distributionMode: "source"`
- `distributionMode: "bundle"`

这样可以复用现有 zip/checksum/extract 安装链路，不引入新的安装入口。

## Source 归档规则

`source` 模式打包时：

- 包含：`manifest.json`、`ui/**`、`assets/**`、`README.md`、`marketplace.json`、`main/src/**`、`main/wit/**`、`main/package.json`、`main/tsconfig.json`、锁文件等源码侧内容
- 排除：`main/node_modules/**`、`main/dist/**`、`main/generated/**`、`.napp/**`
- 对 `main.kind = "wasi-http-component"` 的应用，把 `main/app.wasm` 替换成统一占位物
- 对 `main.kind = "wasm"` 的应用，仍可保留真实 wasm，因为它本身就是用户 payload

## 安装与运行

安装逻辑改为：

1. 下载 `.napp`
2. 解包
3. 读取 `distributionMode`
4. 若为 `bundle`：直接按现有方式安装
5. 若为 `source`：
   - 先把 source 归档展开到临时目录
   - 如果 `main.kind = "wasi-http-component"`，执行本地构建物化
   - 构建完成后再复制到正式 install 目录
6. 运行阶段不感知 source/bundle 差异，仍然只读取 install 后的 runtime layout

## CLI 默认策略

- `napp pack`：默认 `--mode source`
- `napp publish`：默认 `--mode source`
- `napp validate-publish`：默认按 `source` 校验
- `napp pack --mode bundle`
- `napp publish --mode bundle`
- `napp validate-publish --mode bundle`

## Marketplace / Registry 合同

registry version 的 `dist` 扩展为：

- `kind: "source" | "bundle"`
- `bundle: <download-path>`
- `sha256: <sha256>`

说明：

- `bundle` 字段继续表示 `.napp` 下载地址，不改 URL 形态
- `kind` 决定安装端拿到后是“直接安装”还是“先物化再安装”
- 这样老的 bundle 版本仍能继续工作，新客户端则能识别 `source`

## 验收标准

1. `napp pack` 默认输出 `distributionMode = "source"` 的 `.napp`
2. `napp publish` 默认发布 `source` 模式
3. `napp publish --mode bundle` 仍可发布老模式
4. `napp install <app-id>` 能从 registry 安装 `source` 分发的应用
5. 安装后的运行目录仍满足现有 runtime 合同
6. `create -> publish(source) -> install -> run` 真实链路通过
7. 旧的 bundle 安装链路不回归

## 非目标

- 本次不把所有工具链彻底内置到桌面发行包
- 本次不做远端编译平台
- 本次不追求从根上解决 componentize 产物偏大的问题
- 本次不重写 runtime contract
