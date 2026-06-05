# Panel App 运行时排障

本文件只在用户报告具体 Panel App 运行时报错时读取。不要把这些低频排障细节搬回 `SKILL.md` 主流程。

## `Failed to execute 'fetch' on 'Window': Illegal invocation`

常见原因是浏览器原生方法丢失调用 owner，例如把 `window.fetch` 存到对象字段后通过 `object.fetchImpl(...)` 调用，浏览器会把 `this` 绑定到该对象而不是 `window`。

排查顺序：

1. 先查 Panel App 自己是否直接解构、转存或包装了 `window.fetch`、`window.alert` 等浏览器原生方法。
2. 如果 Panel App 只调用 `window.nextclaw.client.*`，继续查宿主注入的 `/api/panel-app-client-sdk.js` 是否是最新 bundle。
3. 在 browser SDK bundle 中确认请求层不是 `fetchImpl = fetch` 后再以 `this.fetchImpl(...)` 调用；正确形态应保证最终通过 `resolvedFetch.call(globalThis, ...)` 或等价方式调用。
4. 如果源码已修但运行中仍报错，检查宿主服务是否缓存了旧 browser bundle，或用户当前打开的是全局安装版而不是源码开发版。

修复原则：

- 不修改具体生成应用来掩盖 SDK 问题。
- SDK / 宿主注入链路要保证默认 fetch 在浏览器里带正确 receiver。
- Panel App 如需直接使用原生 fetch，写 `window.fetch(...)`，不要把它当普通函数长期保存。
