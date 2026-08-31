---
"nextclaw": patch
---

显著降低 Portable Rust/WASI Action 的并发内存成本。Spin runner 现在在进程内共享 Runtime、Engine、FactorsExecutor 和已加载 Component，每个调用只创建独立的 Store、Instance 与任务上下文；十个简单 Action 的本机并发 physical footprint 增量由约 113.60 MiB 降至 2.61 MiB，连续 1000 个 Job 不再形成阶梯增长，同时保留权限、数据、取消、超时、Provider 与 Resident 合同。
