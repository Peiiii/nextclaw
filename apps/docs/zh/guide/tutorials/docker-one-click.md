# Docker 部署

Docker 适合把 NextClaw 放到服务器或长期运行环境里。  
如果你只是第一次试用，先用 [快速开始](/zh/guide/getting-started)。

## 适合场景

- 你有一台长期在线的服务器
- 你希望环境可复制
- 你希望和反向代理、域名、远程访问一起使用

## 部署前确认

- 已准备 Docker 环境
- 已确定配置目录放在哪里
- 已准备模型 provider 的认证信息
- 已明确谁能访问这个实例

## 部署后检查

```bash
nextclaw status
nextclaw doctor
```

如果容器内没有 CLI，请用容器日志和健康检查确认服务状态。

## 相关文档

- [运行与托管手册](/zh/guide/runtime-hosting)
- [远程访问](/zh/guide/remote-access)
- [密钥管理](/zh/guide/secrets)
