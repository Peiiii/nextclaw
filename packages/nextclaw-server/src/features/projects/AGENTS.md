# Projects server boundary

- 本目录只拥有 Projects 的 HTTP 输入校验、状态码映射和公共 API 类型；产品语义一律调用 kernel 的 Projects 公共合同。
- 不在 controller 中解析配置、文件、Skills 或会话正文，也不扫描目录、拼装材料投影或维护第二份缓存与状态。
- 工作项写路由只做输入校验、actor 归一化与错误映射，必须调用 kernel 的 `ProjectWorkManager`，不得建立第二份持久化或生命周期语义。
