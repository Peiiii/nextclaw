## 目录预算豁免
- 原因：该目录承载 client SDK 对外 namespace 的薄 service owner，当前每个 service 文件对应一个稳定 API namespace；在正式拆分 SDK feature 目录前，保留扁平 service 列表更利于对外接口审阅与导出一致性。
