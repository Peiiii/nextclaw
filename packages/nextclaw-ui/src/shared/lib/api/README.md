## 目录预算豁免

- 原因：`shared/lib/api` 是历史形成的前端 API facade 根边界，当前仍需要保留若干公共导出、类型、query cache、runtime update helper 与测试入口。新的 endpoint 薄封装已收敛到 `utils/` 子目录，后续继续治理时应优先减少根目录直接文件，而不是继续新增 root 文件。

## 子树边界豁免

- 原因：`shared/lib/api` 是历史形成的前端 API facade，当前同时承载 client、endpoint wrapper、query cache、transport helper 与 response view types。本次新增 `ncp-session.types.ts` 是为了把会话类型从超大的 `types.ts` 中拆出，实际降低核心类型文件体积；完整子树化需要同步改造大量公共导出和调用方，适合单独结构治理批次推进。
