# 进阶配置

进阶配置面向已经跑通 NextClaw、并且明确知道自己要调整什么的用户。

如果你还没有完成第一次可用回复，先看 [快速开始](/zh/guide/getting-started)。

## 适合放在这里的内容

- 工作区模板
- 精确配置路径
- 多模型或多会话绑定
- 高级运行参数
- 本地调试和脚本化维护

## 不应该从这里开始

不要用进阶配置来完成第一次安装。  
不要为了“更完整”一开始就改很多配置。  
不要把密钥直接写进普通配置文件。

## 推荐顺序

1. 先用 UI 完成基础配置。
2. 用 `nextclaw doctor` 确认健康。
3. 再修改精确配置路径。
4. 每次只改一个方向，并验证结果。

## 常用命令入口

```bash
nextclaw config get <path>
nextclaw config set <path> <value>
nextclaw config unset <path>
```

完整命令见 [命令索引](/zh/guide/commands)。
