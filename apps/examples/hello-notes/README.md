# Hello Notes

`hello-notes` 是一个最小官方示例 app。

它会读取用户已经授权的 notes 目录，统计文档数量和文本字节数，再通过 Wasm 主模块返回一个简单分值。

## Local workflow

```bash
napp inspect ./apps/examples/hello-notes
napp pack ./apps/examples/hello-notes
napp install ./apps/examples/hello-notes
napp grant nextclaw.hello-notes --document notes=/absolute/path/to/notes
napp run nextclaw.hello-notes
```

## Publish workflow

```bash
napp publish ./apps/examples/hello-notes
```
