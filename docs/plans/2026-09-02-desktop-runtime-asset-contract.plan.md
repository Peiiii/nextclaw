# Desktop 运行时资源合同执行计划

上位设计：[Desktop 运行时资源合同设计](../designs/2026-09-02-desktop-runtime-asset-contract.design.md)

## 最终结果

- contract-id：`desktop-runtime-assets-v1`
- parent-goal：一次性建立 Desktop bundle 的统一运行时资源合同，完成实现迁移、重复 owner 删除和充分验证。
- scope-revision / scope-confirmation：`2 / user-confirmed-one-delivery`

## 整体验收契约

- 必须成立：资源声明唯一；复制与最终 ZIP 验证共享合同；最终 ZIP 有逐文件 inventory；平台原生依赖和 extensions 继续正确；真实旧外壳升级门禁保留。
- 必须不发生：不得保留 WASM/worker/native 的第二份必需名单；不得改变 bundle 路径协议、用户数据或 launcher 更新语义；不得用仅检查构建目录替代最终 ZIP 证明。
- 架构不变量：config 是声明 owner，utils 是复制与验证 owner，build service 只编排，native-resource service 继续拥有原生产物生成。
- 代表性场景：静态文件/目录复制、动态 worker chunk、平台 native tree、extension 生成、最终 ZIP 缺失/额外/篡改、Windows 0.44.1 旧外壳升级。
- 交付边界：本任务完成源码、测试、设计/计划、CI 门禁和本地/远端验证；未经本轮单独授权不发布新稳定版本。
- 真实边界：不治理用户数据、下载应用/插件内容或全仓库任意文件读取。

## 阶段图

| 阶段 | 可验收结果 | 进入下一阶段的门 | 状态 |
| --- | --- | --- | --- |
| 合同与执行器 | config、复制器、inventory/ZIP verifier 完整 | 通用合同测试通过 | completed |
| 编排迁移 | build 与 package verifier 使用统一合同，旧名单删除 | 定向构建和最终 ZIP 验证通过 | completed |
| CI 与收尾 | CI 执行合同测试，全部适用验证与 Review 通过 | Required IDs 全部 passed | in-progress |

## Active acceptance ledger

| ID | Required | 合同 | Status | 当前证据 | 失效原因 |
| --- | --- | --- | --- | --- | --- |
| RA-01 | true | 一个配置 owner 声明全部 Desktop bundle 外置资源组、平台条件与必需证据 | passed | `product-bundle-assets.config.mjs` 是唯一声明 owner | — |
| RA-02 | true | 统一执行器完成 file/tree/pattern/prepared-tree 复制，并拒绝冲突、越界和缺失 source | passed | `bundle:test` 5/5；覆盖四类资源、越界、精确/前缀冲突与缺失 source | — |
| RA-03 | true | bundle manifest 包含确定性逐文件 inventory，最终 ZIP 校验集合、大小和 SHA-256 | passed | 缺失/额外/篡改归档反例均失败；最终 seed ZIP 逐文件复算通过 | — |
| RA-04 | true | native packages、Sharp 二进制/libvips 与 extensions 按平台精确验证 | passed | macOS arm64 真实 bundle 6 个 native packages/11 个 extensions 通过；Windows x64 平台夹具通过 | — |
| RA-05 | true | build service 与 package verifier 不再维护资源专用复制/必需名单 | passed | 两处消费者均调用共享合同/verifier，旧资源专用复制与内嵌 ZIP 名单已删除 | — |
| RA-06 | true | 通用测试证明缺失、额外、篡改、空 pattern、冲突和平台错误均被拦截 | passed | `pnpm -C apps/desktop bundle:test` 5/5 | — |
| RA-07 | true | 当前宿主最终 product bundle、共享 ZIP verifier、安装包真实启动、TypeScript/lint 无回归 | passed | macOS arm64 DMG 208.1 MB；seed 45.8 MB；runtime 493/520；runtime init、GUI/chat load、bootstrap readiness、tsc、lint 全通过 | — |
| RA-08 | true | Windows 旧外壳升级及 Windows/macOS/Linux Desktop CI 保持通过 | pending | CI 门禁已接入合同测试，等待本分支远端全平台运行 | 尚无本次提交对应的三平台 runner 结果 |

## 执行顺序

1. 新增 config 与 utils，完成合同解析、复制、inventory 和 archive verifier；设计策略复用上位设计。
2. 新增参数化 Node 测试，先证明合同失败边界；设计策略轻量内联，不新增框架。
3. 迁移 build service、package verifier 和 Desktop CI，删除旧复制/名单；设计策略复用上位设计。
4. 执行定向测试、bundle build、ZIP 验证、tsc/lint、maintainability 和远端全平台 Desktop CI；失败返回对应实现 owner，不降低验收合同。

## 中断恢复入口

恢复时先读取本文件的 ledger，再检查 `git status` 和最新测试证据。任何实现变化使已通过证据失效时，将对应 ID 标记为 `stale` 后重验；不得从文件存在或局部构建成功推断整体完成。

## 当前阶段门

- 结果：合同、执行器、共享最终 ZIP verifier、Windows 平台夹具和 macOS 真实安装包证据已经闭合。
- 保持项：不改变现有 bundle 路径、原生资源生成 owner和 extension 构建语义。
- 场景：四种资源 kind、错误 source/target、最终 ZIP inventory。
- 本阶段不做：不发布稳定版本；该边界不影响实现和完整验证。
- 待关闭缺口：RA-08 远端 Windows/macOS/Linux Desktop CI。

## 新发现与契约变更

- scope revision 2 只修正验证证据分工：本机证明 macOS 真实产物，Linux/Windows 真实产物由对应 runner 证明；功能范围与架构合同未扩大。
- macOS node_modules 不安装 `@img/sharp-win32-x64`，因此本地跨目标 Windows bundle 会在原生资源准备阶段正确失败；不把该环境限制伪装成 Windows 产物验证。

## 尚未关闭

- open-required：RA-08。
