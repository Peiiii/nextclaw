# 发布 / 部署方式

## 适用范围

- 桌面安装器构建与发布（macOS `.pkg`、Windows `.exe`）

## 过程

1. 推送包含安装器改造的代码到主分支。
2. 触发安装器 CI（tag 或手动 workflow dispatch）。
3. 产物上传到 GitHub Release assets。
4. 发布前检查：
   - macOS 包可安装
   - 首次启动在无 Node 场景可自动安装并启动
   - Windows 包可安装（Node 自动安装失败时应给出清晰提示并允许重试）

## 闭环说明

- 本次变更不涉及后端服务和数据库。
- 远程 migration：不适用。
- 线上 API 冒烟：不适用。
