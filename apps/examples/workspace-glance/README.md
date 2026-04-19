# Workspace Glance

`workspace-glance` 是一个官方示例 app，用来快速查看一个已授权 workspace 目录的体量。

## Local workflow

```bash
napp inspect ./apps/examples/workspace-glance
napp pack ./apps/examples/workspace-glance
napp install ./apps/examples/workspace-glance
napp grant nextclaw.workspace-glance --document workspace=/absolute/path/to/workspace
napp run nextclaw.workspace-glance
```

## Publish workflow

```bash
napp publish ./apps/examples/workspace-glance
```
