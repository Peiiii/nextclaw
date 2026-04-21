# 当前目标

- 从 `packages/nextclaw-ui/src` 开始，严格自上而下逐层治理，不再只做局部叶子优化
- 第一优先级是尽快减少 `src` 这一层 legacy roots 数量，直到只剩 allowed roots：`app`、`features`、`shared`、`platforms`

# 明确非目标

- 不是继续按单个小文件慢搬
- 不是为了“看起来有进展”去深挖下层而放过上层结构债务
- 不是顺手引入新的 alias / shim / 兼容层膨胀

# 冻结边界

- 当前任务属于非功能治理，默认 `非测试代码净增 <= 0`
- 只能把真实实现迁入 allowed roots，不能继续在 legacy roots 扩张
- 每批完成后必须最小验证、更新记录、英文 commit，再自动进入下一批

# 已完成进展

- 已把 `rootPolicy` 收紧到 `contract-only`
- 已持续把 `components/config`、`components/chat`、`lib` 的多条实现链迁入 `features/*` 与 `shared/*`
- 第四十九批已提交：`src/lib/channel-tutorials.ts -> src/features/channels/utils/channel-tutorials.utils.ts`
- 第五十批已提交：`src/styles`、`src/test`、`src/stores` 已从顶层清空并向上回收
- 第五十一批已完成待提交：`transport` 已从错误的 `platforms/transport` 纠偏到 `shared/lib/transport`，`platforms/transport` 已被清空

# 当前下一步

- 先提交第五十一批
- 然后继续按“顶层 root 清空优先”推进：
- 下一梯队：`hooks`
- 后续梯队：`lib`、`api`
- 最后处理：`components`

# 锚点计数器

- 当前计数：15/20
