# 输入面板插件 Host 设计

## 背景

输入区插件化后，`/` skill 和 `@` panel app 共用了 input surface 机制，但部分弹出面板状态仍留在 `ChatInputBar` 和 composer keyboard controller 中，例如 active item index、菜单 open 判断和 Enter 选中逻辑。这导致输入区既负责编辑，又负责弹出面板控制，违背了插件化的初衷。

## 核心判断

输入区应该只是编辑器。它只产出编辑事件，并执行编辑命令。

弹出面板应该由 input surface 插件运行时负责。插件 session 决定是否展示、如何移动高亮、如何确认选中，以及选中后向编辑器发什么命令。

## 现状依据

- `ChatInputBar` 持有 `activeInputSurfaceIndex`，说明面板内部选中态泄漏到了输入区容器。
- `ChatInputBarTokenizedComposer` 接收 `slashItems`、`activeSlashIndex`、`onSlashActiveIndexChange`，说明 composer keyboard controller 仍感知菜单数据。
- `ChatInputSurfaceMenu` 接收外部 active index，说明弹出面板不是自包含实例。

## 推荐方案

引入一个薄的 `ChatInputSurfaceHost`：

- host 接收 composer 发出的 editor snapshot 与输入原因。
- host 按插件 trigger spec 解析当前 trigger。
- host 维护当前 input surface session 是否存在。
- host 将有效 trigger 传给上层业务 hook 解析插件 panel。
- host 挂载当前 panel，并将 keydown 委托给 panel handle。
- host 不保存 active index，不知道具体 skill/panel app 业务。

`ChatInputSurfaceMenu` 改成自包含 reference picker panel：

- 自己管理 `activeIndex`。
- items/open 变化时重置为第一行。
- 自己处理 ArrowUp、ArrowDown、Enter、Tab、Escape。
- 通过 `onSelectItem` 把选中项交回 host，host 再调用 composer command。

## Owner 与数据流

```text
Composer
  -> editor snapshot(nodes, selection, reason)
  -> ChatInputSurfaceHost
  -> resolve trigger by trigger specs
  -> business hook resolves plugin panel
  -> ChatInputSurfaceMenu
  -> onSelectItem
  -> Composer command(insert token / replace range)
```

职责边界：

- `Composer`：文本、selection、输入事件、编辑命令。
- `ChatInputSurfaceHost`：input surface session 生命周期与 panel 挂载。
- `ChatInputSurfaceMenu`：reference picker 面板内部交互状态。
- `InputSurfacePlugin`：业务 items、loading、select 语义和 token 映射。

session 创建规则：

- 只有 `insert-text` 且插入文本等于 marker 时，才能创建新的 session。
- 当前 session 存在时，query 输入可以更新同一个 session。
- 空格、Esc、选中 item、blur 或 trigger 离开匹配范围会销毁 session。
- 删除、selection change、sync、programmatic update 不能从无到有创建 session。

## 非目标

- 本轮不重写 plugin API 为完整 class runtime。
- 本轮不改变 skill / panel app 的文本协议。
- 本轮不新增业务 metadata；panel app 和 skill 仍通过 token/text protocol 表达。

## 验收标准

- `ChatInputBar` 不再保存 active item index。
- composer 不再接收 `slashItems`、`activeSlashIndex`、`onSlashActiveIndexChange`。
- 输入 `/` 或 `@` 可以创建面板；输入 query 只更新当前 session。
- 空格、Esc、选中 item、离开 trigger 会销毁 session。
- 删除或 selection sync 不能让已销毁面板重新出现。
- 每次重新输入 `/` 或 `@` 打开的面板默认 active 第一行。
- TypeScript、定向测试、lint、治理和浏览器冒烟通过。
