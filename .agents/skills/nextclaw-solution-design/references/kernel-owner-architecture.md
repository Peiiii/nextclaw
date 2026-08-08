# Kernel Owner 架构

## 核心模型

- `kernel` 拥有 NextClaw 产品语义、跨入口状态和稳定业务 owner。
- `service/runtime host` 只拥有进程、宿主、启停、升级、远程访问和环境适配。
- manager/store/presenter 分别拥有领域状态、持久化事实或视图投影，不双写同一事实。
- contribution 是 kernel 的可卸载扩展分支，只注册稳定能力，不形成第二套 kernel。

## 裁决规则

- 多入口共享、长期存在且定义产品行为的能力进入 kernel 主干；单协议、渠道、平台或可卸载能力作为分支，通过稳定 contribution 合同连接。
- 分支不得反向让主干依赖具体实现。稳定 owner 可直接依赖稳定子 owner，不用 factory/create/getter 包装确定关系。
- 上层组合生命周期，下层维护自身状态与业务语义；父级不重复暴露子级同名转发方法。业务层传 owner 或调用快照，不拆成 bus/path/getter/setter/callback 参数包。
- resolver/registry/adapter 只在隔离真实多实现或协议边界时成立。
- 一个 owner 产生和修改一个事实；store 不与 manager 双写，presenter 只投影视图模型。跨 owner 请求优先复用标准 ingress/event bus。
- 协议事件保持事实纯度，路由、展示和权限 metadata 不混入协议 payload。
- constructor 建立对象图；有副作用的 load/start/reload/stop/dispose 显式分离。订阅、watcher、stream 和临时资源由创建 owner 统一 drain。
- 迁移写清最终 owner、调用方切换和旧 owner 删除点，不保留无限期 alias/proxy。

输出主干/分支归属、唯一事实 owner、直接依赖、生命周期入口、待删除的透传或平行路径，以及为什么无需额外 factory/registry。
