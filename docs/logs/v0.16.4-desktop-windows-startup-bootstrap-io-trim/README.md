# v0.16.4-desktop-windows-startup-bootstrap-io-trim

## 迭代完成说明

- 排查了 Windows 桌面端“双击后长时间无界面”的启动链路，确认主因不在 React 渲染或 `nextclaw init`，而是在桌面窗口创建前的 product bundle 预处理。
- 确认当前桌面端首启会先处理 `seed-product-bundle.zip`，旧链路会对约 2.1 万个文件执行 `JSZip` 解压，然后再把整个 bundle 目录额外递归复制一遍；这在 Windows Defender / 企业杀毒 / 慢盘环境下很容易被放大成分钟级卡顿。
- 优化了 bundle 安装链路：
  - `DesktopBundleService.installFromDirectory()` 现在优先直接 `rename()` 把已验证 bundle 移入版本目录，只有在跨设备或 Windows 权限类失败时才回退到原来的复制方案，避免每次安装都额外整包复制。
- 优化了桌面 seed bundle 构建链路：
  - `build-product-bundle.service.mjs` 现在会在 `pnpm deploy` 后裁剪运行时 `node_modules` 中明显不参与生产执行的内容，例如 `*.d.ts`、`*.d.mts`、`*.d.cts`、`*.map`、Markdown 文档、常见 lint/prettier/git 元文件，以及 `docs/examples/tests` 一类目录。
  - 这一步是为了直接降低首启解压文件数和 Windows 文件扫描压力，而不是只做表面 loading。
- 实测同一份本地 seed bundle 构建结果从约 `33MB / 21331` 文件 / `130.39MB` 解压体积，降到约 `18MB / 11843` 文件 / `62.44MB` 解压体积。

## 测试/验证/验收方式

- 已执行：`pnpm -C apps/desktop build:main`
- 已执行：`pnpm -C packages/nextclaw exec tsx --test ../../apps/desktop/src/launcher/__tests__/launcher-foundation.test.ts ../../apps/desktop/src/launcher/__tests__/update-coordinator.service.test.ts`
- 已执行：`pnpm lint:maintainability:guard`
- 已执行：`pnpm -C apps/desktop bundle:seed`
- 已执行：使用真实 `apps/desktop/build/update/seed-product-bundle.zip` 调用编译后 `DesktopUpdateService.stageLocalArchive()`，确认新 seed 包仍可被成功安装并激活。
- 已执行：重新统计 seed 包构建结果，确认瘦身生效：
  - 旧统计基线：`33MB`，`21331` 文件，解压后约 `130.39MB`
  - 新统计结果：`18MB`，`11843` 文件，解压后约 `62.44MB`

## 发布/部署方式

- 桌面端按既有流程重新构建发行物即可：
  - `pnpm -C apps/desktop build:main`
  - `pnpm -C apps/desktop bundle:seed`
  - `pnpm -C apps/desktop dist`
- 本次修改不要求额外迁移步骤；新安装包会自动携带更瘦的 seed bundle，首次启动时也会少一次整包复制。

## 用户/产品视角的验收步骤

- 在 Windows 干净环境安装新的桌面端安装包。
- 双击应用后，观察是否仍存在“长时间无窗口、看起来像没响应”的情况。
- 首次启动完成后再次关闭并重开，确认后续冷启动不再重复 seed 安装导致的长时间等待。
- 如仍有个别机器明显偏慢，检查桌面日志中 bundle bootstrap 阶段耗时，并优先排查杀毒/企业安全软件对大量小文件展开的拦截。

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：
  - 本次是沿着“更少 I/O、单路径更明确、启动前隐式工作更少”的方向推进了一步。虽然没有做到总代码净减少，但明确删掉了一次不必要的整包复制，并把 Windows 启动慢的根因从“模糊怀疑页面慢”收敛成可解释、可验证的启动前 I/O 热点。
- 可维护性复核结论：通过
- 本次顺手减债：是
- 代码增减报告：
  - 新增：208 行
  - 删除：60 行
  - 净增：148 行
- 非测试代码增减报告：
  - 新增：208 行
  - 删除：60 行
  - 净增：148 行
- no maintainability findings
- 本次是否已尽最大努力优化可维护性：是
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是
  - 已删除或收敛的复杂度主要有两点：安装阶段不再默认执行二次整包复制；seed bundle 不再携带大量明显无运行价值的声明文件、sourcemap 与文档垃圾。
  - 本次未实现总代码净删除，原因是需要新增一段明确的构建期裁剪规则来换取更少的运行时 I/O；这是当前最小必要新增。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 总代码量净增，但运行时实际处理的文件数和解压体积大幅下降，启动链路复杂度下降。
  - 文件数与目录平铺度没有新增恶化，仅在原脚本内补了构建期裁剪逻辑。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：
  - 是。运行时安装优化仍收敛在 `DesktopBundleService`，构建期瘦身逻辑仍收敛在 bundle 构建脚本，没有把行为散到 launcher / runtime / update 多处补丁化叠加。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 满足。治理守卫已通过。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：
  - 已执行独立复核。结论是本次增长主要来自构建期裁剪规则，本质是在用有限且边界清晰的构建代码，换取更小的 seed 包与更少的启动期 I/O，属于可接受且最小必要的增长。
