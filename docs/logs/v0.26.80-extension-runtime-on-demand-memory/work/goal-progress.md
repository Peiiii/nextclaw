# 目标进度锚点

- 计数器：20/20
- 当前目标：完成扩展运行时按需激活，实现并通过功能、竞态、故障和 Linux 内存验收。
- 验收条件：空配置零扩展进程；按 enabled 差量启停；鉴权跨 poll 不丢；旧 generation 无权收发；并发单 spawn；失败有限恢复；空配置稳定 working set ≤220 MiB；单微信 ≤260 MiB；单 Discord ≤330 MiB。
- 非目标：更换 Node/Bun；合并全部渠道到主进程；修改消息/NCP 语义；未经要求发布或重启当前 NextClaw 实例。
- 冻结边界：复用 ExtensionRuntimeService 与 ExtensionLifecycleService；manifest 只做控制面；活跃扩展继续独立进程；严格 `enabled === true`。
- 已完成：验收合同；按需持续/请求/auth/handoff 租约；generation/token/ready/stream/ingress 隔离；宽限退出与有限重启；SDK lazy adapter；十渠道动态 import；定向自动化 108 项、15 package TypeScript、47 文件 ESLint、治理和可维护性检查；ARM64 Linux 三轮内存；AMD64 生产构建与架构功能；微信和飞书真实扫码、授权、入站、模型与出站主链路。
- 外部边界：取得真实 2 vCPU / 2 GiB AMD64 VPS SSH 入口后，执行空配置、单微信、单 Discord 三轮绝对内存复测；在此之前不把 ARM64 绝对数字承诺为所有 VPS 数字。
