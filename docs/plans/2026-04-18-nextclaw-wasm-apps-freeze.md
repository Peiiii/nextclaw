# NextClaw Wasm Apps 方案冻结稿

## 这份文档的作用

这份文档不是用来继续开放式讨论的，而是用来把当前已经达成共识的关键决策冻结下来，作为后续实现和继续细化的基准。

如果后续实现与本文档冲突，默认以本文档为准，除非我们再次明确修改冻结结论。

## 冻结目标

本轮冻结的不是完整实现细节，而是五件更重要的事：

1. 产品定义
2. 技术主路线
3. 应用包形态
4. 权限与宿主能力边界
5. MVP 范围与非目标

## 冻结结论 1：产品定义

第一阶段正式产品定义为：

**NextClaw Wasm Apps**

它的定位是：

- 一类只运行在 NextClaw 宿主中的微应用
- 由 Web UI、Wasm 模块、manifest 和显式权限组成
- 面向 AI web coding 时代的小应用分发与使用场景

第一阶段明确不定义为：

- 通用 Wasm App 标准
- Docker 替代品
- 通用容器平台
- 任意后端项目迁移层

## 冻结结论 2：技术主路线

技术主路线冻结为：

**NextClaw Host + Wasmtime Runner**

具体分工：

- `NextClaw Host`
  - 安装与卸载
  - 权限展示与授权
  - UI 容器
  - 与 Runner 的调度桥接
- `Wasmtime Runner`
  - 加载 Wasm 模块
  - 注入 host functions
  - 执行 action
  - 返回结果与日志

明确不选：

- `node:wasi` 作为正式安全执行底座
- 直接裸跑 Node/Python 本地后端
- 自研 Wasm 执行引擎

## 冻结结论 3：应用结构

第一阶段应用结构冻结为：

```text
my-app/
  manifest.json
  main/
    app.wasm
  ui/
    index.html
  assets/
    icon.png
```

说明：

- `manifest.json`
  - 记录应用元信息、入口、权限声明
- `main/`
  - 放应用主执行产物
- `ui/`
  - 放应用展示层资源
- `assets/`
  - 图标与静态资源

第一阶段不引入更复杂的多模块结构。

## 冻结结论 4：manifest 最小字段

第一阶段最小 manifest 至少包含：

```json
{
  "id": "com.example.notes",
  "name": "Notes Helper",
  "version": "0.1.0",
  "main": {
    "entry": "main/app.wasm",
    "kind": "javy-js"
  },
  "ui": {
    "entry": "ui/index.html"
  },
  "permissions": {
    "storage": true,
    "allowedDomains": ["api.example.com"],
    "documentAccess": [
      {
        "id": "notes_dir",
        "mode": "read"
      }
    ],
    "capabilities": {
      "llm": false,
      "hostUi": []
    }
  }
}
```

这里的 `kind` 第一阶段默认支持：

- `javy-js`

架构上允许未来增加：

- `rust-wasm`

## 冻结结论 5：UI 装载方式

第一阶段 UI 装载方式冻结为：

- 应用 UI 仍然是普通 Web 前端
- 由 NextClaw 提供固定的 App 容器装载
- UI 不直接访问高权限宿主能力
- UI 只通过 NextClaw Host bridge 请求动作

第一阶段最保守的做法是：

- 用独立 route 或 iframe 容器装载 UI

只要能力边界清楚，两者都可以；实现阶段可根据现有 UI 结构选择成本更低的一种。

## 冻结结论 6：执行模块路线

第一阶段执行模块路线冻结为：

**JS-first，Wasm 执行。**

也就是：

- 开发者优先写 JS/TS 逻辑
- 再通过既定工具链编进 Wasm
- 最终由 Wasmtime Runner 执行

为什么这样定：

- 更符合 AI web coding 产出
- 更适合普通创作者
- 更容易形成生态

架构上保留未来增加：

- `Rust -> Wasm`

但它不是 MVP 主路。

## 冻结结论 7：宿主 API 范围

第一阶段宿主 API 只冻结到下面五类：

1. `storage`
   - 应用私有存储
2. `documentAccess`
   - 用户授权目录
   - 只读 / 读写区分
3. `allowedDomains`
   - 域名白名单
4. `capabilities.llm`
   - 通过 NextClaw 提供
5. `capabilities.hostUi`
   - 通知、跳转、刷新等宿主界面动作

第一阶段明确不开放：

- 任意 shell
- 任意进程管理
- 任意系统调用
- 复杂本机自动化
- 完整数据库服务语义

## 冻结结论 8：调用链路

第一阶段调用链路冻结为：

`App UI -> NextClaw Host -> Host API -> Wasmtime Runner -> Wasm Module`

写死这个链路的目的，是避免下面两类错误：

1. UI 绕过宿主，直接拿高权限
2. Wasm 模块绕过权限层，直接接触本机资源

## 冻结结论 9：MVP 目标

MVP 只需要证明下面六件事：

1. 应用可以被安装
2. 应用 UI 可以被打开
3. 应用逻辑可以在 Wasmtime 中运行
4. 文件和网络访问必须经过权限授权
5. 应用可以调用有限宿主能力
6. 应用可以被卸载

只要这六件事成立，第一阶段模型就已经成立。

## 冻结结论 10：MVP 非目标

MVP 明确不做：

1. 不做通用标准
2. 不做跨宿主兼容
3. 不做复杂 marketplace 协议
4. 不做任意现有项目自动迁移
5. 不做系统级自动化开放
6. 不做完整后端平台能力

## 冻结结论 11：第一批应用类型

第一批优先选择：

- 文件摘要类
- 文档整理类
- API 查询面板类
- 小型知识卡片 / CRM 工具类

第一批不碰：

- 长驻服务
- 复杂数据库后端
- 复杂浏览器自动化
- 强依赖原生包的大型 Node 项目

## 当前仍保留的开放问题

虽然主路线已经冻结，但下面这些仍可在实现前进一步细化：

1. `javy-js` 工具链的具体接法
2. UI 最终选 iframe 还是 route 容器
3. Wasmtime Runner 采用 sidecar 还是更深的嵌入式集成
4. LLM 权限的最小暴露 contract

这些问题影响实现细节，但不影响本轮冻结的主路线。
