## 目录预算豁免
- 原因：provider 目录当前同时保留协议归一化、provider routing、catalog registry 与协议适配实现；在确认更稳定的二级分层前，需要维持这组直接入口文件并列存在，避免把 provider 选择、协议转换和 catalog 元数据再塞回单个热点文件。
