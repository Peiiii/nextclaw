# 内联可视化资产存储设计

## 背景

内联 HTML 可视化需要一个真实文件供宿主读取。放在 `/tmp` 会因系统清理而失效，直接写入当前项目或工作目录又会污染用户文件，因此需要由 NextClaw 持有独立、持久的生成资产目录。

## 目录与 owner

会话内生成、只用于结果展示的可视化统一写入：

```text
NEXTCLAW_HOME/
  assets/
    visualizations/
      <session-id>/
        <artifact>.html
```

- `NEXTCLAW_HOME/assets` 是 NextClaw 持久资产根。
- `visualizations/<session-id>` 是生成式可视化的独立命名空间，与 managed attachment store 的日期/opaque-id 子树分离。
- 系统上下文负责给 Agent 提供当前会话的精确绝对目录；Agent 不猜测 home，也不根据当前工作目录决定落点。

## 写入与展示链路

1. Agent 判断内联 HTML 是最合适的展示媒介。
2. Agent 创建系统给出的会话资产目录，并写入自包含 HTML。
3. Agent 重新读取文件，核对内容与数据。
4. 最终 `nextclaw-inline` 的 `file` target 使用该文件的绝对路径和 `viewer: "rendered"`。
5. 现有 server-path 内容接口读取绝对路径，现有内联 iframe 负责渲染；不新增第二套资源协议。

## 生命周期与边界

- 第一版不自动清理这些文件，保证历史会话再次打开时仍可展示。
- 不写入 `/tmp` 或其他临时目录，也不平铺到当前项目、工作目录或 `NEXTCLAW_HOME` 根部。
- 用户明确要求项目交付文件时，文件归用户项目，不适用本目录。
- 产物默认自包含，避免相对资源 URL 在内容接口下产生额外路径解析合同。
- 后续如需空间回收，应由 NextClaw 按会话引用和保留策略统一清理，不能由 Agent 在生成回合自行删除。

## 验收标准

- 自然语言请求触发可视化时，Agent 无需用户指定目录。
- 生成文件位于 `NEXTCLAW_HOME/assets/visualizations/<session-id>/`。
- 文件不位于 `/tmp`、用户项目或工作目录根部。
- 关闭并重新打开会话后，内联 HTML 仍可读取和渲染。
