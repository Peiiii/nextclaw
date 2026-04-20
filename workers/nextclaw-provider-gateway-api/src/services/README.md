## 子树边界豁免
- 原因：`workers/nextclaw-provider-gateway-api/src/services` 当前仍是包内历史扁平服务目录。本轮只触达了 `remote-quota-guard.service.ts` 以配合 `remote-quota` 子树治理，尚未同步完成 `marketplace / platform / remote` 三组 service 的稳定拆分；为避免在同一批次把范围扩成多组无关重构，先显式记录豁免，下一轮再按子域收拢。
