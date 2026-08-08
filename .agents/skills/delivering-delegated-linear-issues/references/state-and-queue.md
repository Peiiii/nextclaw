# Linear 状态与队列

- 新队列：`Todo + Delegated to Agent +（无 Agent 状态或 Agent: Queued）`；按优先级、同级旧到新。Blocked/Delivered/Claimed 和 Done/Canceled/Duplicate 跳过。
- `Delivery: Local Master` 只强化默认，不影响领取资格；更具体的当前用户说明优先。
- 人工指定 issue 只处理该 ID；只调查/方案时不 claim、不改状态。
- 批量处理冻结一次扫描快照，期间新 issue 留到下次。
- 默认定时扫描绑定当前会话 heartbeat；只有用户明确要求独立新会话才用 standalone cron。回读确认 kind、target、周期和启用状态，避免重复自动化。
- 用户明确重试 Blocked/Delivered 时，确认旧 Run 停止，再替换为 Queued。
