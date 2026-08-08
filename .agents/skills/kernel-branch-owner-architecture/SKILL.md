---
name: kernel-branch-owner-architecture
description: 仅当决策涉及 NextClaw kernel 主干、runtime host、manager/store/presenter、contribution、生命周期装配或稳定 owner 依赖关系时使用；普通 owner 命名、局部参数和一般重构不自动触发。
---

# Kernel 主干与分支 Owner 架构

## 核心模型

- `kernel` 拥有 NextClaw 产品语义、跨入口状态和稳定业务 owner。
- `service/runtime host` 拥有进程、宿主、启动停止、升级、远程访问和环境适配。
- manager/store/presenter 各自拥有领域状态、持久化事实或视图投影，不互相复制事实。
- contribution 是 kernel 的扩展分支；只注册稳定能力，不成为第二套 kernel。

## 判断规则

### 主干与分支

- 多入口共享、长期存在且定义产品行为的能力进入 kernel 主干。
- 单一协议、渠道、平台或可卸载能力作为分支 owner，通过稳定 contribution 合同连接。
- 分支不得反向让主干依赖自己的具体实现或路径。

### Owner 依赖

- 稳定业务 owner 可直接依赖稳定子 owner，不用 factory/create/getter 包装已确定关系。
- 上层组合生命周期，下层维护自身状态和业务语义；父级不重复暴露子级同名方法。
- 业务层优先传 owner，不把 owner 拆成 bus、path、getter、setter 和 callback 参数包。
- 新 resolver/registry/adapter 只有在隔离真实多实现或协议边界时成立。

### 状态与流程

- 事实由一个 owner 产生和修改，store 不与 manager 双写同一状态。
- presenter 只投影视图需要的稳定模型，不拥有底层业务状态。
- 跨 owner 请求优先复用现有 ingress/event bus；新增总线前确认不存在标准入口。
- 协议事件保持事实纯度，路由、展示和权限 metadata 不混进协议 payload。

### 生命周期

- constructor 建立确定对象图；load/start/reload/stop/dispose 承担副作用。
- 订阅、watcher、stream 和临时资源由创建它们的 owner 统一收集并 drain。
- 迁移必须写清最终 owner、调用方切换和旧 owner 删除点，不保留无期限 alias/proxy。

## 输出

说明主干/分支归属、唯一事实 owner、直接依赖关系、生命周期入口、要删除的透传或平行路径，以及为什么不需要额外 factory/registry。不要在本 skill 中重新编排调查、实现或验证流程。
