# NextClaw App SDK

`@nextclaw/app-sdk` 是给 NextClaw Apps 前端使用的轻量 bridge client。

它只做一件事：把 app UI 对宿主的调用收敛成稳定 API，而不是让每个 app 都自己拼 `fetch("/__napp/...")`。

## 安装

```bash
npm install @nextclaw/app-sdk
```

## 用法

```ts
import { createNappClient } from "@nextclaw/app-sdk";

const client = createNappClient();

await client.health();
await client.getManifest();
await client.getPermissions();
await client.runAction("summarizeNotes");
```

## API

- `createNappClient(baseUrl?)`
- `health()`
- `getManifest()`
- `getPermissions()`
- `runAction(action?)`
