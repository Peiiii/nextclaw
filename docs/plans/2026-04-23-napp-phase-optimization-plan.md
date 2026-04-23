# NApp 分阶段优化执行方案

## 目标

在不推翻现有 `manifest.json + main/ + ui/ + assets/` 合同、不重做 Docker 心智的前提下，把当前 NApp TS/WASI HTTP 链路从“本地基本自洽”推进到“线上发布可靠、包体更合理、普通用户体验更顺”。

本次严格按三阶段执行，并在阶段边界上做独立提交：

1. `phase 1`：先补发布闭环基础能力，完成后单独提交
2. `phase 2`：再做包体优化，验证通过后单独提交并发布
3. `phase 3`：最后做普通用户体验收口

## 现状问题

当前问题已经确认有两类：

- 发布协议问题：Apps marketplace 旧的 app publish 校验仍停留在 `main.kind="wasm"` + `export/action`，会拒绝新的 `wasi-http-component`
- 包体问题：`main/app.wasm` 本身偏大；同时此前 `.napp` 打包过宽，可能把 `main/node_modules` 等构建期文件一并带入发行包

因此不能只优化体积，也不能只修发布协议，必须先把主链路闭环补齐。

## Phase 1

### 目标

让“本地创建的 TS/WASI HTTP app 能通过正确协议完成商店发布前校验”，并且失败尽量在本地提前暴露，而不是等到远端拒绝。

### 范围

- 补齐 apps marketplace 对 `wasi-http-component` manifest 的兼容
- 引入 `napp validate-publish <app-dir>`，统一本地发布前检查
- `validate-publish` 最小检查项：
  - manifest 主入口是否合法
  - `marketplace.json` 是否存在且可解析
  - bundle 是否可打包
  - bundle 内是否只包含运行时必需文件
  - bundle / main entry size 是否可见，并给出 warning

### 非目标

- 不在 phase 1 追求显著缩小 `app.wasm`
- 不做桌面 App Center
- 不引入复杂审核规则系统

### 验收

- `wasi-http-component` app 不再因协议不兼容被本地/服务端老合同拒绝
- `napp validate-publish` 能在本地输出可读结果
- 新命令具备 JSON 输出，方便 skill 编排

## Phase 2

### 目标

在不破坏当前 TS 开发体验的前提下，把“用户看到的发布包体”进一步收敛，并提供一条更轻的模板路径。

### 推荐方案

保留现有 `ts-http` 作为开发体验优先模板，再新增一个更轻量的 `ts-http-lite` 模板作为体积优先模板。

原因：

- 直接把 `ts-http` 改成极轻实现，会损失当前 Hono 心智和开发体验
- 只做构建参数微调，未必能稳定显著降体积
- 同时保留 `ts-http` 与 `ts-http-lite`，能把“体验优先”和“体积优先”变成显式选择

### 范围

- 新增 `ts-http-lite` scaffold
- 保持运行时合同、发布合同一致
- 对比 `ts-http` 与 `ts-http-lite` 的实际 `app.wasm` / `.napp` 大小
- 更新 skill / README，明确什么时候用 lite

### 验收

- `ts-http-lite` 可 build / run / pack
- `.napp` 体积相比 `ts-http` 有明确下降
- phase 2 完成后做一次单独提交，并发布新的 runtime 版本

## Phase 3

### 目标

把普通用户真正会遇到的体验断点继续收口，而不是继续加底层抽象。

### 范围

- skill 优先走 `napp validate-publish`
- 根据用户意图在 `ts-http` / `ts-http-lite` 间做推荐
- 改善发布失败与依赖缺失时的提示文案
- 文档里把“开发、发布、安装、运行”的主路径写成普通用户语言

### 非目标

- 不在本阶段做完整桌面 App Center
- 不把所有底层依赖彻底内置到桌面发行包

## 提交与发布策略

- 提交 1：只包含 phase 1 相关代码与文档
- 提交 2：只包含 phase 2 相关代码与文档
- 发布：phase 2 验证通过后再发包/发布
- phase 3：在 phase 2 发布后继续做体验收口，避免把体验层改动和协议/体积层改动混成一次大提交

## 验证策略

### Phase 1

- `packages/nextclaw-app-runtime`: `test` / `tsc` / `lint`
- `workers/marketplace-api`: `tsc`
- 本地 `napp validate-publish` smoke

### Phase 2

- `ts-http-lite` 的 `create -> build -> run -> pack`
- 对比 `ts-http` 与 `ts-http-lite` 包体
- 发布前复跑 `validate-publish`

### Phase 3

- 用 skill 走一遍普通用户路径：
  - 创建
  - 构建
  - 发布前校验
  - 发布
  - 安装
  - 运行
