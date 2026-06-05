# v0.20.28 PWA Runtime Simplification

## 迭代完成说明

本次修复 `http://127.0.0.1:18888/chat/sid_bmNwLW1wenJjdTF4LTBjMDVjOWQz` 在浏览器里首屏加载前反复 reload 的问题，并按产品取舍把 PWA 收敛为轻量安装能力。

根因：PWA runtime 把更新检测、等待 worker 激活、`controllerchange` 后 reload、dev service worker 清理后 reload、service worker `skipWaiting` / `clients.claim` 和导航缓存放在主应用启动链路上。PWA 对 NextClaw 不是核心用户能力，这些生命周期控制让聊天主入口受 service worker / 缓存状态影响，页面在加载早期容易进入重复导航。

后续复测又暴露出第二层根因：已有浏览器里的旧 service worker 仍可能控制页面，并从旧 `nextclaw-ui-runtime-v2` 缓存返回过期 chunk。表现为新 `index-DZoXsgdz.js` 请求 `./api-DhI2lb1f.js` 的 `et` 导出，但浏览器实际拿到旧 api chunk，触发 `does not provide an export named 'et'`。服务器返回的新 api chunk 本身包含该导出，因此问题在浏览器侧旧 service worker 缓存。

确认方式：先用真实 18888 URL 复现页面加载行为；随后在持久化浏览器 profile 中观察到主 frame 高频重复导航。修复后重新构建并重启 18888，确认同一路径在普通浏览器上下文和持久化 profile 中 5 秒内只有 2 次初始导航，页面进入 `readyState=complete`，聊天界面渲染完成。

修复方式：删除 PWA update banner、update 状态、主动刷新接口和 service worker 强制接管逻辑；service worker 只缓存 manifest、logo、icon、offline page 等安装壳资源，不再拦截导航或缓存运行时 JS/CSS。同时在 production HTML 的模块入口前增加一次性旧缓存恢复脚本：检测当前页面已经被 service worker controller 控制时，unregister 旧 service worker、删除 `nextclaw-ui-*` 缓存，并 reload 一次，避免既有用户继续拿到旧 runtime chunk。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test -- src/features/pwa/components/pwa-install-entry.test.tsx src/features/pwa/managers/pwa-service-worker-cache.manager.test.ts`：通过，2 个文件 7 个测试通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui exec eslint ...`：触达文件定向 ESLint 通过。
- `pnpm -C packages/nextclaw-ui lint`：通过，0 errors，32 warnings；warnings 为既有非触达文件维护性 warning。
- `pnpm -C packages/nextclaw-ui build && pnpm -C packages/nextclaw build`：通过，生成并复制本地 UI dist；`packages/nextclaw` build 同步了 `packages/nextclaw/resources/USAGE.md`。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：通过，无 errors / warnings。
- 浏览器冒烟：访问 `http://127.0.0.1:18888/` 与 `http://127.0.0.1:18888/chat/sid_bmNwLW1wenJjdTF4LTBjMDVjOWQz`，页面完成加载并渲染聊天界面；普通上下文无 `SyntaxError` / `pageerror`。
- 旧 service worker 恢复冒烟：持久化 profile 中先建立 service worker controller，再 reload；恢复脚本执行后 `nextclaw-pwa-legacy-runtime-cache-cleaned-v1=1`，controller 清空，缓存只剩 `nextclaw-ui-shell-v2`，页面稳定进入 `NextClaw - Chat`。

## 发布/部署方式

本次未执行线上发布。当前只完成本地源码修复、本地 production build 和 18888 本地 serve 验收。

## 用户/产品视角的验收步骤

1. 启动或刷新本地 `nextclaw serve --ui-port 18888`。
2. 打开 `http://127.0.0.1:18888/chat/sid_bmNwLW1wenJjdTF4LTBjMDVjOWQz`。
3. 页面应稳定进入聊天界面，不应在首屏前持续 reload。
4. PWA 仍保留安装入口和 manifest/icon 等安装壳资源，但不再显示更新刷新提示，也不再由 service worker 接管导航。
5. 对已有旧 service worker 缓存的浏览器，首次打开可能出现一次自动刷新；刷新后不应再出现 `api-DhI2lb1f.js does not provide an export named 'et'`。

## 可维护性总结汇总

本次使用 `post-edit-maintainability-review` 思路复核，结论通过。正向减债动作是删除与简化：删除 PWA 更新提示、更新状态、主动刷新、导航缓存和强制接管路径，让 PWA owner 只保留安装所需的最小运行时职责。

最终 maintainability guard 报告：检查 10 个源文件，新增 23 行、删除 247 行、净减少 224 行；非测试新增 11 行、删除 196 行、净减少 185 行；无 errors / warnings。

这不是单纯压缩行数：删除的是会影响主聊天入口稳定性的运行时生命周期分支、状态字段和 UI 控件，行为面更小，PWA 与聊天主链路的耦合更低。

## NPM 包发布记录

本次未执行 NPM 包发布。已新增 changeset，后续统一发布时应 patch 发布 `@nextclaw/ui` 与 `nextclaw`：前者包含 PWA runtime 源码修复，后者携带本地 serve 使用的 `ui-dist` 产物。
