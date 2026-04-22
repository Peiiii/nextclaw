# 当前目标

- 已完成：`packages/nextclaw-ui/src` 已严格自上而下收敛到只剩 allowed roots（`app`、`features`、`platforms`、`shared`）
- 当前顶层 legacy roots：已清空

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
- 第五十二批已提交：`src/hooks` 已整组拆散到 `app/hooks`、`features/account`、`features/channels`、`features/chat`、`features/marketplace` 与 `shared/hooks`，`src/hooks` 与未消费的 `useObservable.ts` 已物理删除
- 第五十三批已完成：`src/api`、`src/lib`、`src/components` 已一次性迁入 allowed roots，空目录已继续向上回收；`src` 顶层现只剩 `app`、`features`、`platforms`、`shared`

# 当前下一步

- 本轮无需继续动作；如后续继续治理，应从 `app` / `features` / `shared` / `platforms` 的下一层开始新一轮自上而下扫描

# 锚点计数器

- 当前计数：0/20
