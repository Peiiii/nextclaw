# NextClaw Resource URI Conventions

## 背景

NextClaw 里已经同时存在多类“不是普通裸路径”的资源引用需求：

- agent 头像这类受控 home 资源
- 运行期资产仓库里的附件/文件
- 应用自带、随包发布的静态资源

如果每个功能都单独发明自己的图片路径协议，后面会很快变成不可维护的碎片化约定。资源引用应该先有统一规范，再让具体能力复用它。

## 目标

- 让资源引用保持 URI 形态，而不是散落的裸路径字符串
- 把“资源属于哪里”编码进协议本身
- 只保留少量稳定 scheme，避免 feature-specific scheme 膨胀

## 当前统一协议族

### `app://`

- 用途：应用自带、随包发布、只读的内置资源
- 示例：
  - `app://runtime-icons/codex-openai.svg`
  - `app://runtime-icons/claude.ico`
- 解析规则：
  - 资源路径必须是相对 app 资源根目录的受控相对路径
  - 不允许空路径、`.`、`..` 或目录逃逸
  - UI/Web 层可把它解析成对应静态资源 URL，例如 `/runtime-icons/codex-openai.svg`

### `home://`

- 用途：用户或 agent home 目录下的受控本地资源
- 现有使用：
  - agent avatar
- 示例：
  - `home://avatar.svg`
  - `home://images/profile.webp`

### `asset://store/...`

- 用途：运行期资产仓库存储的资源
- 现有使用：
  - NCP 附件与导出资产
- 示例：
  - `asset://store/2026/04/18/asset_abc123`

## 设计规则

1. 不新增 feature-specific scheme

- 反例：
  - `runtime-icon://...`
  - `agent-avatar://...`
  - `session-badge://...`
- 原则：
  - 先判断是否可以落入 `app://`、`home://`、`asset://store/...`
  - 只有出现全新资源域，且无法被现有协议准确表达时，才允许讨论新增 scheme

2. `src` 可以是 URI，但不要求字段名处处改成 `uri`

- 对图片类展示合同，保留 `src` 字段是合理的，因为它本来就表达“浏览器可消费的资源来源”
- 但其值应优先使用标准化的 Resource URI，而不是随手写裸路径

3. 解析层统一做“URI -> 可访问地址”的映射

- 业务描述层只声明资源 URI
- server / UI / runtime 边界层负责解析
- 不允许让上层业务到处知道真实静态目录或本地文件位置

## 对 runtime icon 的落地结论

- runtime/session type 图标统一使用 `app://runtime-icons/<file>`
- 第一方内置图标继续随仓库存放在 `packages/nextclaw-ui/public/runtime-icons/`
- runtime 描述链路只返回 `icon.src = "app://runtime-icons/..."`，不返回官网 URL，也不返回硬编码绝对站内路径

## 非目标

- 不在本次引入完整虚拟文件系统
- 不做所有历史资源协议的一次性大重构
- 不新增图标主题系统
