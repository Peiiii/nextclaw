# Desktop 运行时资源合同设计

## 背景

Desktop product bundle 目前在 `build-product-bundle.service.mjs` 中分别复制 UI、模板、resources、bridge、SQL.js WASM、worker、skills 和原生依赖，再由构建期 `requiredFiles` 与最终 ZIP 校验脚本维护另一组文件名单。`0.48.0` 的 SQL.js JavaScript 被 bundler 收入，但独立的 `sql-wasm.wasm` 没有进入 bundle；新版 Node 路径没有使用 fallback，旧 Windows 外壳启动新版 Runtime 时才暴露缺失。

本设计只治理随 Desktop product bundle 分发、且不能仅依赖 JavaScript bundler 自动闭合的资源。用户数据、运行时生成状态、下载后的应用/插件内容和普通文件系统读写不属于该合同。

## 目标与不变量

- 静态文件、目录、生成匹配项和已准备原生目录由一个声明合同拥有 source、target、平台条件和必需证据。
- 构建复制与最终 ZIP 验证消费同一合同，不再各自维护 WASM、worker、skills、templates 或原生依赖名单。
- 最终 bundle manifest 携带对实际归档内容生成的资源 inventory；每个条目记录路径、大小与 SHA-256，ZIP 验证必须逐项复算，并拒绝未登记文件或缺失文件。
- product-bundle builder 中不再出现资源专用 `cp`；只有统一执行器拥有复制语义。
- 平台原生依赖仍由现有 `prepareDesktopNativeResources` 生成；资源合同只接管其输出，不复制原生构建生命周期。
- extensions 需要改写 manifest 并执行 tsdown，不伪装成普通文件复制；扩展集合仍由同一个合同配置拥有，构建与验证共同消费。

## 主链路

```text
product-bundle-assets.config
  -> resolve source roots / platform target
  -> copyProductBundleAssets
  -> build runtime entrypoint + packaged extensions
  -> createProductBundleAssetInventory(bundleRoot)
  -> write bundle/manifest.json
  -> zip bundle
  -> verifyProductBundleArchive(zip, contract, platform)
```

资源合同只支持当前存在的四种变化轴：

- `file`：SQL.js WASM 等单文件。
- `tree`：UI、templates、resources、skills、bridge 等目录。
- `pattern`：session-search worker 的构建 chunk；必须声明最少匹配数。
- `prepared-tree`：native-resource owner 产出的 `node_modules`。

每项使用稳定 `id`，目标只能位于 bundle root 内；重复 ID、重复目标、越界路径、source 缺失和空的必需 pattern 都在复制前失败。目录可声明少量 `requiredEntries`，用于证明不是复制了错误或空目录，而不把目录内每个普通文件抽象成业务资源 ID。

## Inventory 与最终 ZIP 合同

复制和生成全部完成后，构建器遍历 bundle 中除 `manifest.json` 外的所有文件，按路径排序并生成：

```json
{
  "schemaVersion": 1,
  "files": [
    { "path": "runtime/dist/cli/app/sql-wasm.wasm", "bytes": 658410, "sha256": "..." }
  ]
}
```

最终 ZIP 验证器读取 `bundle/manifest.json` 后必须证明：

- inventory schema 有效、路径唯一且排序稳定；
- ZIP 的全部非 manifest 文件与 inventory 集合完全一致；
- 每个文件的大小和 SHA-256 一致；
- 资源合同展开的必需入口存在；
- native package 集合与目标平台精确一致，Sharp `.node` 与适用的 libvips 存在；
- extension manifest 与 entrypoint 完整；
- runtime file budget 保持有效。

签名 manifest 继续对整个 ZIP 签名，因此 inventory 不替代现有签名，而是让“签名的是不是完整预期产物”可审计。

## Owner 与文件组织

- `apps/desktop/scripts/update/configs/product-bundle-assets.config.mjs`：唯一声明 owner，纯数据与按平台解析函数。
- `apps/desktop/scripts/update/utils/product-bundle-assets.utils.mjs`：复制、合同展开、inventory 和 ZIP 验证的纯/无状态工具。
- `apps/desktop/scripts/update/utils/product-bundle-assets.utils.test.mjs`：合同、缺失、篡改、冲突和平台差异测试。
- 现有 build service 只拥有构建编排、tsdown、extension manifest 变换和 archive 输出。
- 现有 package verifier 调用共享 ZIP verifier，不再内嵌第二份资源清单脚本。

## 方案取舍与过度设计审计

选择“Desktop bundle 局部声明合同”，不建设全仓库资源 registry，也不改所有运行时文件访问为 asset ID。当前证据是一个 bundle 边界内多组重复复制/校验 owner；它足以证明局部合同，但不足以证明用户数据、应用包或任意文件读取都需要统一抽象。

放弃的最强替代方案是只把现有 `requiredFiles` 搬到共享常量。它改动最小，但仍允许复制逻辑、必需清单和最终 ZIP 行为分叉，无法生成可验证 inventory，也不能消除同类资源遗漏。

不引入兼容层或 fallback。旧的复制函数、WASM 特判和 ZIP 内嵌名单在同一改动中删除。

## 失败与恢复

- 合同或 source 错误：构建在创建 ZIP 前明确失败，错误包含资源 ID、source 与 target。
- 最终 ZIP 缺失、额外或被篡改：package verify 失败，不进入发布。
- 平台条件错误：对应平台构建/验证失败；合同单测覆盖所有受支持 target。
- 实现导致真实 Runtime 行为退化：保留现有 Windows 旧外壳升级、安装版、Portable、macOS DMG 和 Linux 包冒烟作为外层证明。

内部重构不改变 bundle 目录协议、launcher compatibility、manifest 签名格式之外的既有字段或用户数据，因此无需迁移和运行期回退。

## 验证标准

- 合同单测覆盖 file/tree/pattern/prepared-tree、重复/越界目标、source 缺失、必需 pattern 为空、inventory 缺失/额外/篡改，以及 Linux/Windows native policy。
- 在当前宿主构建 product bundle，使用共享 verifier 打开最终 ZIP 并通过；Linux 与 Windows 的真实平台产物分别由对应 CI runner 构建验证。
- Desktop TypeScript、lint、相关 Node 测试和 diff-only maintainability 通过。
- 主干 Desktop CI 继续覆盖 Windows 旧外壳真实升级与全部发布平台；本地无法伪装未实际运行的平台结果。
