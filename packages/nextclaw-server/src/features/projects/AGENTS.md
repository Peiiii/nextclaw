# Projects server boundary

- 本目录只拥有 Projects 的 HTTP 输入校验、状态码映射和公共 API 类型；产品语义一律调用 kernel 的 Projects 公共合同。
- 不在 controller 中解析配置、Marker、文件、Skills 或拼装观测快照，也不维护第二份缓存与状态。
- V1 只暴露读接口。新增写路由前必须先冻结独立的产品与授权设计。
