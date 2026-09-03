# WASI Key-Value Runtime 调度与接口收敛设计

## 背景与根因

NextClaw runner 虽然创建了 Tokio multi-thread runtime，却把所有 Component 调用放进 `LocalSet`。Spin 4.0.2 的 SQLite key-value backend 在 `StoreManager::get`、读写、批量与 CAS 路径中调用 `tokio::task::block_in_place`。

`LocalSet::run_until` 会显式禁止其内部 future 使用 `block_in_place`，与外层 runtime 是否为 multi-thread 无关。因此正式 runner 调用标准 `wasi:keyvalue/store` 时在 Spin backend 首次打开数据库处 panic。Spin 自己的 trigger executor 使用普通 `tokio::spawn` 执行 Component Store，并没有这层冲突；缺陷来自 NextClaw 偏离了 Spin 的执行模型。此前 smoke 只覆盖 NextClaw 自有 `host.kv` 与标准 Spin SQLite，没有覆盖标准 WASI key-value；公网 Issue Watcher 测试虽然覆盖了该路径，但位置靠后、依赖公网，而且失败以 30 秒超时呈现。

本次暴露的不只是一个调度 bug：旧脚手架仍引导新组件调用 NextClaw 私有 `host.kv`，该兼容实现又直接读写 Spin 的内部 SQLite 表。也就是说，产品虽然接入了 Spin Factor，却没有把“标准接口、上游执行合同和后端 schema owner”一起收敛给 Spin。

## 目标与边界

- 标准 `wasi:keyvalue/store` 在 action、job 和进程重启生命周期中可读写持久数据，不因 LocalSet 调度方式 panic。
- Spin backend 继续拥有 SQLite schema、批量操作、increment 和 CAS 语义；NextClaw 不复制或分叉这些实现，也不直接访问 `spin_key_value` 表。
- Component Store 按 Spin trigger 的方式由普通 Tokio worker task 独占，不新增持久化实现，也不使用不安全标记。
- 新建 Rust/WASI App 只使用标准 `wasi:keyvalue/store`；已安装旧组件的 `host.kv` 作为兼容入口保留，但委托给同一个 Spin `StoreManager`。
- 不升级 Spin、不改变 runner 协议、不改变存储文件格式，也不以延长 action 超时掩盖 panic。

## 方案比较

### 方案 A：只改变 LocalSet 的外层 runtime 配置

不可行。Tokio 的 LocalSet 在 poll `run_until` 时主动设置 `allow_block_in_place = false`；增加 worker 数、启用 `rt-multi-thread` 或改用 `#[tokio::main]` 都不能改变这个合同。

### 方案 B：在 NextClaw 复制 Spin SQLite store

可以避开 `block_in_place`，但会复制 get/set、批量、increment、streaming keys、CAS、错误和容量限制，形成第二个持久化语义 owner，后续 Spin 升级容易漂移。

### 方案 C：对齐 Spin trigger 的调度、接口与存储 owner

采用。删除 Runner 外层 `LocalSet`，action、Job、Resident 和 Provider 的 Component 调用都通过普通 `tokio::spawn` 执行，与 Spin trigger 一致。`SpinStore` 可以在线程间移动但不能并发共享；Runner 通过 `Arc<tokio::sync::Mutex<_>>` 转交唯一可变所有权，驻留实例仍由 Runner 独占。加载函数使用可变借用，避免把非 `Sync` 的长期 Store 误建模为共享引用。stdout 仍由单一任务输出，但不把 `StdoutLock` 持有到 await 边界。

新脚手架导入 `wasi:keyvalue/store`。legacy `host.kv` 不再打开数据库或认识表结构，而是调用同一份 Spin `StoreManager/Store` 公共合同；旧 JSON 迁移也通过该公共合同写入。这样兼容入口只做协议转换，不成为第二个存储实现。

`tokio::spawn` 的 `Send + 'static` 约束同时构成编译期门禁：如果未来的执行路径重新捕获不可跨线程的 Component 状态，构建会直接失败，而不是线上运行时才发现。

## 主链路与不变量

```text
runner control loop
  -> tokio::spawn（Spin trigger 同型调度）
  -> 新组件：wasi:keyvalue/store -> Spin KeyValueFactor
  -> 旧组件：host.kv -> Spin StoreManager 公共合同
  -> Spin SQLite StoreManager / Store / CAS
  -> portable-kv.sqlite
```

- 每个请求只创建一个普通 Tokio task；不在 key-value trait 内二次调度。
- Runner 和驻留 Store 只转移唯一可变所有权，不要求 Store 为 `Sync`。
- Job 的取消与完成事件语义保持不变；普通 action、Resident 和 Provider 仍经过同一 Runner owner。
- app data directory、`default` label、现有数据库和 legacy JSON migration 都保持不变。
- Engine、FactorsExecutor、Component cache 与共享 runtime 保持不变；不以每请求重建 runner/runtime 换取正确性。

## 自动化拦截设计

1. Rust 构建通过 `tokio::spawn` 的 `Send` 约束检查全部请求和 Job 执行 future；不能回退到 `spawn_local` 或把非 `Send` Store 跨任务共享。
2. runner smoke 使用真实 GitHub Issue Watcher Component 调用 `issues_list`，覆盖 `tokio::spawn -> Component -> wasi:keyvalue/store -> Spin SQLite`。测试预置确定性 snapshot，校验 Component 读到标准 WASI key-value 数据，不访问 GitHub。
3. 现有完整 runner smoke 继续覆盖自有 `host.kv`、Spin SQLite、并发 Job、取消、Resident 和 Provider，防止适配器破坏相邻 runtime 能力。
4. 现有公网 Issue Watcher smoke 继续覆盖 `issues_sync` 写入与随后 `issues_list` 复读，但它是外部集成证据，不再是发现线程模型错误的第一道门。
5. 脚手架测试禁止新模板生成 `host::kv_*`，真实生成并编译一次 Rust Component，防止 WIT、Cargo component metadata 与示例代码彼此漂移。
6. 提交前比较同一 runner benchmark 的热调用延迟、吞吐与 action/resident 内存；共享 runtime/cache 不变量不能为修复而退化。

## Active acceptance contract

- contract-id：`wasi-keyvalue-runtime-scheduling-v1`
- parent-goal：修复正式 runner 的标准 WASI key-value panic，并用自动化测试阻止同类调度退化。
- scope-revision：1；无范围缩减。

| ID | Required | 合同 | Status | 当前证据 | 失效原因 |
| --- | --- | --- | --- | --- | --- |
| WKV-01 | true | 原始 `issues_list` panic 在真实 runner 中消失 | passed | 公网 Issue Watcher smoke：sync 后 persisted list 成功，8 issues | 无 |
| WKV-02 | true | 所有 Component invocation 与 Spin trigger 一样运行在普通 Tokio worker | passed | `cargo check`；`tokio::spawn` 的 `Send` 编译门禁 | 无 |
| WKV-03 | true | 无公网的真实 Component smoke 覆盖标准 `wasi:keyvalue/store` | passed | 预置 Issue Watcher snapshot；Job 读取与重启复读通过 | 无 |
| WKV-04 | true | 原 runner runtime、Job、SQLite、取消、Resident、Provider 合同无回归 | passed | 完整 runner smoke 42 checks 全部通过 | 无 |
| WKV-05 | true | 公网 Issue Watcher 完成 sync 写入和 list 复读 | passed | `github-sync`、`persisted-list`、`standard-wasi-kv`、`public-issue-shape` | 无 |
| WKV-06 | true | Rust 构建、格式、lint/治理和 diff review 通过 | passed | cargo test/build、定向 rustfmt/ESLint、maintainability/governance 通过；无阻塞 finding | 无 |
| WKV-07 | true | 新 Rust/WASI 脚手架使用标准 key-value 且真实可构建 | passed | app-runtime tsc、4 个定向测试、真实 `napp create` + `napp build` 产出 wasm32-wasip2 Component | 无 |
| WKV-08 | true | legacy `host.kv` 与 JSON migration 只通过 Spin 公共 Store API 访问同一存储 | passed | cargo migration test；runner smoke 的 legacy KV 与标准 KV 42 项通过 | 无 |
| WKV-09 | true | 修复不回退共享 runtime/cache 的性能设计 | passed | 同机复测：P95 3.68 ms（基线 11.33），691 ops/s（基线 165）；10 action 81.36 MiB（基线 74.59），10 resident 88.39 MiB（基线 90.06） | 无 |
| WKV-10 | true | Design/Validation 对上游合同与真实标准接口形成通用门禁 | passed | skill progressive-loading、governance backlog ratchet 通过 | 无 |

## Design Ready

设计缺口属于上游合同没有被完整建模：标准 WASI key-value 的普通 action、Job、Resident、Provider 和恢复生命周期共享同一执行不变量，存储 schema 与行为由 Spin 拥有。采用方案 C，删除 LocalSet，直接复用 Spin 的普通 Tokio worker 模型；新组件走标准接口，旧接口只保留薄兼容转换，删除生产代码对 Spin 私有表的访问。内置 legacy fixture 暂时保留用于证明已安装旧组件兼容，不把兼容路径继续推广给新项目。延后 Spin 上游是否改变 backend 实现的跟进，不为未发生的升级增加兼容层。
