## 目录预算豁免
- 原因：`ncp` 目录同时承载 UI NCP runtime 装配、session/asset 读写服务、runtime registry、message bridge 与对应测试；当前这些文件需要围绕同一入口边界扁平组织，短期内会超过 `20` 个直接代码文件。
