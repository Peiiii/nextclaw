## 子树边界豁免

- 原因：`chat/ncp/` 目录是 NCP 聊天运行时的装配子树，需要并列保留页面数据、派生状态、输入/线程 manager、session adapter 与测试文件。本次新增派生状态模块是为了拆短 `ncp-chat-page.tsx`，属于职责下沉，而不是继续把复杂度堆回页面壳。
