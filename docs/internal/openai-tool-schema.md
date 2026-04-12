# OpenAI Tool Schema 规范

## 目的

这份规范约束的是“发给 OpenAI / OpenAI-compatible provider 的 tool parameters schema”，目标很简单：

- 不把 provider 会直接拒绝的 schema 发出去
- 不把条件分支校验硬塞到 provider-facing schema 顶层
- 让工具定义从源头保持稳定、可预测、可维护

## 适用范围

- 所有会进入 `tools[].function.parameters` 的 schema
- 包括 native chat/completions、responses，以及兼容 OpenAI wire format 的 provider

## 项目内强制规则

### 1. 根 schema 必须是 `type: "object"`

这也意味着：

- 不能省略 `parameters`
- 即使工具没有参数，也要显式写成空 object schema

允许：

```ts
{
  type: "object",
  properties: {
    path: { type: "string" },
  },
  additionalProperties: false,
}
```

不允许：

```ts
{
  oneOf: [...],
}
```

无参工具应写成：

```ts
{
  type: "object",
  properties: {},
  additionalProperties: false,
}
```

## 2. 根 schema 顶层禁止这些关键字

- `oneOf`
- `anyOf`
- `allOf`
- `enum`
- `not`

说明：

- 这些约束如果放在顶层，当前 OpenAI-compatible provider 会直接在请求入口拒绝
- 项目里已经有本地断言阻止这类 schema 进入请求链路

## 3. 顶层尽量只做“字段声明”，不要做“条件编排”

推荐：

- 用一个普通 object 声明所有可能字段
- 用 `additionalProperties: false` 收紧字段集合
- 条件必填、互斥关系、跨字段规则，放到运行时 `validateArgs`

不推荐：

- 顶层 `oneOf` 表示“要么 path，要么 bytesBase64 + fileName”
- 顶层 `allOf` / `not` 拼复杂合同

## 4. 条件规则放在运行时校验

例如 `asset_put` 这种“二选一”输入模式，正确写法是：

- schema 顶层保持普通 object
- `validateArgs` 负责检查：
  - `path` 和 `bytesBase64` 不能同时出现
  - 使用 `bytesBase64` 时必须同时给 `fileName`

## 5. 发现新工具 schema 设计需求时的默认判断顺序

1. 先问：顶层能不能只是一个普通 object？
2. 再问：复杂约束能不能下沉到 `validateArgs`？
3. 只有字段本身的类型约束留在 schema 里
4. 不要为了“schema 更完整”把 provider-facing schema 变成 provider 不接受的形状

## 当前项目实现

- `asset_put` 已经按这套规则整改
- NCP context builder 在把工具定义转成 OpenAI tools 前，会先做一次本地断言
- 如果以后有人再写出不合规顶层 schema，项目会在本地直接报错，而不是等线上 provider 400

## 参考

- OpenAI Function Calling:
  - https://platform.openai.com/docs/guides/function-calling
- OpenAI Structured Outputs:
  - https://platform.openai.com/docs/guides/structured-outputs
