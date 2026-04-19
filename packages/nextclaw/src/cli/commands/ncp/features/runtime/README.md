# NCP Runtime Command Modules

这里存放 UI/NCP runtime 相关命令入口、运行时桥接与对应测试。

## 目录预算豁免

- 原因: 当前目录同时承载 `create-ui-ncp-agent` 主链路、`nextclaw-ncp-runner`、asset tool，以及围绕这些入口的高相关回归测试。本批次继续触达该目录是为了修复 Claude 嵌套模型路由并补齐回归；短期内保留集中放置有利于避免在修复窗口里额外搬迁测试。后续若继续增长，应优先把 runner、asset、create-ui-ncp-agent 测试按责任拆到稳定子目录。
