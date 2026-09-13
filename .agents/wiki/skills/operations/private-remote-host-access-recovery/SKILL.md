---
name: private-remote-host-access-recovery
description: 当用户已授权访问私有 VPS 或远程 Linux 主机，但 SSH 入口未知、TCP 22 在认证前失败，或需要建立安全可复用的备用 SSH 传输时使用；不处理 NextClaw 产品自身的 remote access。
---

# 私有远程主机 SSH 访问恢复

## Owner 与完成条件

本 Skill 负责把“已获授权但当前无法稳定 SSH 登录”的私有主机恢复为可重复使用、可验证且不泄露凭据的命令行入口。它不拥有业务部署、NextClaw `remote` 产品链路、云网络长期架构或系统安全加固；恢复 SSH 后，把后续工作交还原任务 owner。

仅在下列情况加载：

- `.local/remote-environments.private.md` 中已有匹配主机，或用户明确给出并授权该主机；
- SSH 地址、端口或认证方式不清楚；
- TCP 已连通但在 SSH banner / key exchange / authentication 之前被关闭；
- 需要借助已登录的云控制台建立备用入口。

完成必须同时满足：

1. 一条不含密码、token 或私钥内容的本机 SSH 命令或别名可重复连接；
2. 已在新连接中核验主机身份、登录用户和最小远程命令；
3. 备用服务、监听端口、原服务影响和回滚点均有证据；
4. 仅把验证后的连接事实更新到私有环境清单，公共 Skill 中不出现实例身份或凭据。

## 先定位失败阶段

先读取私有环境清单的匹配条目，再用一次有界诊断区分失败层级：

```bash
ssh -vvv -o ConnectionAttempts=1 -o ConnectTimeout=10 <user>@<host>
nc -vz -w 5 <host> 22
```

按最早失败点判断：

| 证据 | 阶段 | 下一步 |
| --- | --- | --- |
| timeout / no route | 路由、安全组或防火墙 | 核对公网地址、云安全组和主机防火墙 |
| connection refused | 目标端口无监听或主动拒绝 | 从云控制台检查 `sshd` 与监听地址 |
| 收到 SSH banner 后进入 host-key 或认证 | SSH 链路已经打通 | 处理主机指纹、用户或认证方式，不改传输层 |
| `kex_exchange_identification`、连接在远端 banner 前关闭 | TCP 22 路径可能被中间网络干预 | 先证明主机内 `sshd` 正常，再评估备用传输 |
| host key changed | 主机身份不一致 | 停止连接，从可信控制面重新核验指纹，禁止直接删除检查 |

“网页能打开”和“SSH 22 可用”是两条不同链路。认证前失败时不要反复更换密码；密码尚未参与握手。

## 从可信控制面证明主机侧 SSH

优先使用用户已经登录的云控制台、串口终端、Cloud Assistant 或现有管理入口执行只读检查：

```bash
sshd -t
systemctl status sshd --no-pager
ss -ltnp
ssh -o BatchMode=yes -o ConnectTimeout=5 localhost true
```

不同发行版的 unit 可能叫 `ssh`。本机回环连接能够进入认证、`sshd -t` 通过且 22 正确监听，只能证明主机侧服务正常；外部仍在 banner 前关闭时，继续调查云安全组、云防火墙、来源网络或中间链路。

不得为了“试试看”重启健康的 `sshd`、开放宽泛端口或覆盖现有防火墙规则。主机有共存服务时，先查端口 owner 和完整配置。

## TLS 封装 SSH 备用入口

当且仅当以下条件同时成立时，可把 SSH 封装进一个独立 TLS 监听：

- 已证明 `127.0.0.1:22` 上的 SSH 正常；
- 直连 22 的外部路径在认证前被干预，且短期无法从网络控制面修复；
- 用户授权范围包含恢复远程命令行入口；
- 目标 TLS 端口未被 HTTPS、Nginx、Caddy、负载均衡或其它服务占用；
- 已准备配置备份、明确 systemd unit 和回滚命令。

先确认端口和服务 owner：

```bash
ss -ltnp
systemctl list-units --type=service --state=running
nginx -T
```

可用 `stunnel` 建立单用途链路，核心拓扑为：

```text
client ssh -> TLS listener:<tls-port> -> 127.0.0.1:22 -> sshd
```

服务端配置只表达传输关系，不保存 SSH 密码：

```ini
[ssh]
accept = 0.0.0.0:<tls-port>
connect = 127.0.0.1:22
cert = <certificate-path>
key = <private-key-path>
```

证书、私钥权限、包名和 systemd unit 随发行版而异，必须读完整现状后安装和启用。不要占用现有 443；若 443 已有 TLS owner，应选择经授权的独立端口或修复原 22 路径，不能把现有网站挤掉。

客户端使用无凭据的 SSH alias：

```sshconfig
Host <alias>
    HostName <host>
    User <user>
    ProxyCommand openssl s_client -quiet -connect %h:<tls-port> -servername %h 2>/dev/null
    ServerAliveInterval 30
    ServerAliveCountMax 3
```

TLS 只改变外层传输，SSH host key 仍是端到端主机身份边界。首次建立备用入口时，从可信控制面核验并固定 SSH 指纹；证书可验证时也应启用证书验证。禁止用 `StrictHostKeyChecking=no` 掩盖身份异常。

## 凭据纪律

- 优先交互式输入密码；不得把密码放进 `~/.ssh/config`、命令参数、脚本、Skill、提交、日志或回复。
- 不运行会把整份私有环境清单、认证文件或代理配置原样输出到工具结果的命令；只提取完成当前判断所需的非敏感字段。
- 不把私有清单复制进 worktree、临时诊断目录或远端主机。
- 本机 alias 只保存地址、用户和传输方式。已有 SSH key 时复用安全的 key 路径，不复制私钥内容。

## 验证与留痕

从一个全新 SSH 进程验证，不能只依赖安装时仍存活的 shell：

```bash
ssh -G <alias>
ssh <alias> 'whoami; hostname; uptime'
```

服务端同时核验 TLS wrapper、`sshd`、监听关系和失败重启策略。再次测试直连 22，以明确这是“原链路已恢复”还是“备用链路可用”；不要把两者混写。

私有环境清单只更新经过真实验证的事实：

- 本机 alias 与备用入口拓扑；
- SSH 主机指纹和可选 TLS 证书指纹；
- 服务 unit、配置/回滚备份位置；
- 最近验证时间、验证入口和当前直连状态。

若备用入口失败，先停止并禁用新建 unit，恢复原配置和端口状态，再重新验证原有服务。后续 AI 看到已验证 alias 时应直接使用 SSH；只有 alias 失效时才回到本 Skill，不要继续用网页逐条代替命令行诊断。
