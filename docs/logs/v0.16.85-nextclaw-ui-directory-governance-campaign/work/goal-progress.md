# 当前目标

- 从 `packages/nextclaw-ui/src` 开始，严格自上而下逐层治理，先把 `src` 这一层收敛到只剩 allowed roots
- 当前顶层 legacy roots 只剩 `api`、`components`、`lib`

# 明确非目标

- 不是继续做零碎 leaf 迁移
- 不是为了短期过关去放宽 contract-only 规则
- 不是为了兼容去新增膨胀型 shim / alias 链

# 冻结边界

- 当前任务属于非功能治理，默认 `非测试代码净增 <= 0`
- 真实实现只能落在 `app`、`features`、`shared`、`platforms`
- 每批完成后必须验证、写回记录、英文 commit，然后自动进入下一批

# 已完成进展

- 第四十九批已提交：`src/lib/channel-tutorials.ts -> src/features/channels/utils/channel-tutorials.utils.ts`
- 第五十批已提交：`src/styles`、`src/test`、`src/stores` 已从顶层清空并向上回收
- 第五十一批已提交：`transport` 已从错误的 `platforms/transport` 纠偏到 `shared/lib/transport`
- 第五十二批已完成待提交：`src/hooks` 已整组拆散到 `app/hooks`、`features/account`、`features/channels`、`features/chat`、`features/marketplace` 与 `shared/hooks`，`src/hooks` 与未消费的 `useObservable.ts` 已物理删除

# 当前下一步

- 先提交第五十二批
- 然后继续按顶层 root 清空优先推进：先扫 `src/lib`，再扫 `src/api`
- `src/components` 放到 `lib/api` 之后处理

# 锚点计数器

- 当前计数：6/20
