# NPM Beta 更新候选选择设计

## 问题与证据

NPM Runtime 更新管理器只解析当前通道的一条 manifest URL。线上 `beta` 清单为 `0.48.0-beta.2`、`stable` 清单为 `0.48.1` 时，选择 beta 的 `0.48.0-beta.2` 安装仍只读 beta 清单，无法发现更高的正式版本。旧测试虽然使用 beta launcher 版本，却把 manager 通道固定为 stable，因此没有覆盖真实链路。

## 冻结语义

- stable 通道只检查 stable manifest。
- beta 通道同时检查 beta 与 stable manifest，完成签名、平台和架构校验后按语义版本选择最高候选；同版本优先 stable。
- 显式 `--manifest-url` 或 `NEXTCLAW_UPDATE_MANIFEST_URL` 保持单源，避免推断自定义镜像结构。
- 候选中任一标准 manifest 获取或验签失败时检查失败，不在信息不完整时声称已经是最新。

## 已安装旧 launcher 的兼容

客户端多源逻辑只能随新的 NPM launcher 到达用户。为覆盖已安装且仍只读取 beta manifest 的版本，stable Runtime 发布同时生成一份独立签名、`channel=beta`、但复用同一 stable bundle 的兼容 manifest。发布器只有在 stable 版本严格高于现有 beta 时才替换 beta manifest；更高或同版本 beta 保持不变。

## 验证合同

- `0.48.0-beta.2` + beta `0.48.0-beta.2` + stable `0.48.1` 必须得到 `availableVersion=0.48.1`。
- beta 高于 stable 时必须继续选择 beta。
- stable 检查不得请求 beta；显式 manifest URL 不扩展为多源。
- stable 发布兼容 manifest 必须独立验签，并且 bundle URL、摘要、签名和版本与 stable manifest 一致。
- 发布器不得用较低或同版本 stable 覆盖 beta manifest。

## 范围

本次只修复 NPM Runtime 更新与其发布通道；不修改 Desktop 更新实现，不执行 NPM 发布、Runtime 通道发布或服务重启。
