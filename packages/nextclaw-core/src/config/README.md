## 目录预算豁免
- 原因：`config` 目录当前同时承载 schema、loader、reload、provider routing、profile 与安全脱敏入口；这些文件都是对外稳定入口，现阶段继续维持并列结构比把多种职责重新塞回单个热点文件更可维护。
