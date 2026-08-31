# WASI 文档访问后置授权实施计划

## 计划状态

- 日期：2026-08-31
- 状态：Local Acceptance Ready
- 类型：Feature
- 风险：L3（跨 App Runtime、Kernel、Server、CLI、UI 与 WASI 生命周期）
- 对应设计：[WASI 文档访问后置授权设计](../designs/2026-08-31-wasi-document-access-authorization.design.md)
- 对应问题：[NC-163](https://linear.app/dimstack/issue/NC-163/wasi-documentaccess-%E8%A1%A5%E9%BD%90%E7%94%A8%E6%88%B7%E7%9B%AE%E5%BD%95%E6%8E%88%E6%9D%83%E4%B8%8E%E7%AE%A1%E7%90%86%E7%9A%84%E6%AD%A3%E5%BC%8F%E9%97%AD%E7%8E%AF)
- Rust runner 变更：不适用；复用现有 preopen 与已构建 runner artifact
- 交付边界：当前普通工作区与常用本地端口；不创建隔离 worktree/实例；不提交、不推送、不发布

## 一、目标与成功条件

在不改变 Rust runner 合同的前提下，让已声明 `permissions.documentAccess` 的 App 能从同一 Kernel owner 完成目录权限的查看、后置授予、模式选择、替换和撤销，并由 Server、CLI、Apps UI 共同消费；真实 WASI 调用必须证明授权前拒绝、授权后按 read/read-write 工作、替换和撤销立即生效。

## 二、活跃验收账本

范围修订：`1`

| ID | 分类 | 验收项 | 当前状态 | 证据目标 |
| --- | --- | --- | --- | --- |
| NC163-001 | Required | `AppPackageView` 和 inspect API 投影声明 scope、授权状态、实际模式与可用动作 | passed | Kernel/Server 定向测试与 18792 inspect API |
| NC163-002 | Required | Kernel owner 校验已声明 scope、真实目录、canonical path 和声明 mode 上限，并持久化 grant | passed | App Runtime/Kernel 定向测试 |
| NC163-003 | Required | Apps 页面复用 `ServerPathPickerDialog`，支持 grant、replace、read/read-write、revoke 与错误反馈 | passed | UI 11/11；5174 真实页面已打开 picker 并验证两种 mode 提示 |
| NC163-004 | Required | CLI 通过同一 API 支持 inspect、grant、revoke | passed | CLI 16/16；本地 inspect/grant/revoke 已执行 |
| NC163-005 | Required | 未授权、模式不足和资源不可用返回稳定 document scope 错误及恢复动作，不泄露宿主路径 | passed | 真实 HTTP 401/409 合同与恢复动作 |
| NC163-006 | Required | grant/replace/revoke 使旧 runtime lane/capability snapshot 失效；真实 WASI 读写与目录隔离成立 | passed | 普通实例真实 WASI read/write/replace/revoke/`..` 隔离 smoke |
| NC163-007 | Required | host restart 后 grant 仍存在；声明收窄/删除不再装配；uninstall 清理 active grant | passed | 冷重载真实读取；registry 旧记录迁移、收窄、删除、卸载回归 |
| NC163-008 | Required | 用户文档、CLI 中英文全集、changeset、类型检查与定向测试同步 | passed | 6 包 tsc；73 个定向测试；CLI reference test；中英文文档与 changeset |
| NC163-009 | Required | 常用本地端口运行可验收实例，并提供链接和人工验收步骤 | passed | 18792/5174 在线；Apps 页面和 picker 无 console error |
| NC163-010 | Not required | 一次性文件/目录 `DocumentRef` | not-applicable | 设计已明确为 Phase B；当前 action input、ephemeral snapshot 与 job cleanup 均无稳定消费合同，本次不新增闲置协议 |

除 `NC163-010` 外，任何 Required 项未通过都不得宣称 NC-163 本地交付完成。

## 三、单一 owner 与主链

```text
Apps UI / nextclaw CLI
  -> Server App Packages API
  -> Kernel AppPackageManager（唯一产品 owner）
  -> AppGrantService / AppRegistryService（校验与持久化 adapter）
  -> AppPackage runtime hooks（停止旧 lane、恢复 persistent component）
  -> capability resolver
  -> 现有 Rust runner /documents/<scope-id> preopen
```

- registry 是持久 grant 的唯一事实源，不复制到 generic capability store。
- shared path picker 只负责 runtime host 路径浏览；App、scope、mode 和 mutation 归 Apps feature。
- CLI、Server 和 UI 不直接读写 `registry.json`。
- 不新增 action-level document schema；Phase A 的稳定错误由 Kernel owner 在授权检查和 mount 解析边界产生。

## 四、实施切片

### Slice 1：App Runtime 与 Kernel owner

1. 扩充持久 grant 记录和旧字符串记录迁移读取，保留显式开发启动所用的简单 path map。
2. `AppGrantService` 校验目录类型、realpath、声明 mode 上限，并输出稳定 scope view。
3. `AppPackageManager` 增加 inspect/grant/revoke 公共合同和结构化错误映射。
4. grant mutation 对启用 App 使用 runtime prepare/change hooks，失败时恢复旧记录和旧 runtime。
5. resolver 只装配 active/compatible/available grant，并使用 effective mode。

### Slice 2：Server、Client SDK 与 CLI

1. 增加 App Package document access inspect/grant/revoke 路由。
2. Client SDK 只投影 Kernel 返回合同。
3. 注册 `nextclaw app permissions inspect` 与 `document grant/revoke`，支持显式 path 和 mode。
4. CLI 输出 App、scope、用途、模式和脱敏资源摘要；非交互失败返回结构化错误。

### Slice 3：Apps UI

1. App package view 展示“文件与文件夹”scope 列表。
2. Apps 业务组件编排 mode 与授权动作，直接复用 `ServerPathPickerDialog`。
3. grant/replace/revoke 后重新读取 owner 状态；mutation 期间禁用重复动作并保留明确反馈。
4. 中英文 i18n 同步。

### Slice 4：真实产品链 fixture、文档与验证

1. 为内置 Portable Runtime Lab 声明 read 与 read-write scope，复用现有已编译 WASI filesystem action，不重编 Rust。
2. 覆盖授权前、read、read-write、隔离、replace、revoke、restart、声明变化和 uninstall。
3. 更新中英文用户权限说明与 CLI 能力全集，添加用户可见 changeset。
4. 按定向测试 → 匹配范围 tsc → 单机真实产品链 → diff-only maintainability review 的顺序收尾。
5. 在当前普通实例的常用端口提供本地链接与人工验收脚本。

## 五、实现门

- 优先复用现有 `AppGrantService`、`AppRegistryService`、`AppPackageManager`、runtime hooks、Server controller、Client SDK、CLI controller 和 `ServerPathPickerDialog`；不建第二 permission manager 或 picker。
- 新增类型或字段必须有本批调用者；不预埋 `DocumentRef`。
- raw canonical path 只存在 registry/runtime host 内部；Guest、Server 错误和验证记录不得包含它。Apps 权限管理页可显示宿主侧选择摘要。
- Rust 源、Cargo、Guest 源和 native workflow 不在实现范围。若真实 smoke 证明现有 lane 无法释放 descriptor，回到设计再扩大范围。
- 不触碰工作区现有的无关设计文档改动。

## 六、验证漏斗

1. App Runtime parser/grant/registry unit tests。
2. Kernel AppPackage owner、resolver 与 lifecycle integration tests。
3. Server controller、Client SDK、CLI controller、Apps component/hook tests。
4. 触达 package 的 `tsc`；测试或 lint 不替代类型检查。
5. 使用既有 runner artifact 的真实 WASI read/write/isolation/replace/revoke smoke；本批不运行 Cargo build。
6. 常用端口 HTTP/API/UI smoke 和人工验收路径。
7. diff-only maintainability 自动检查与 findings-first 复核。

## 七、停止条件

- 发现必须改变 Rust runner transport 或新增 action/document schema 才能满足 Required 项时，停止实现并返回 Design。
- 当前普通实例存在会被启动/刷新破坏的用户任务时，不强行重启，先报告并请求授权。
- 无法在不覆盖用户 WIP 的前提下修改重叠文件时，保留现场并报告阻塞。
