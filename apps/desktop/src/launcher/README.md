# Desktop Launcher Layers

- `services/`
  - 服务层。
  - 放真正有业务编排职责的主对象。
  - 当前包括 `bundle.service.ts`、`bundle-lifecycle.service.ts`、`update.service.ts`。
  - 其中 `update.service.ts` 负责 update manifest 拉取、归档下载、zip 解包、bundle 安装与 candidate 激活。
- `stores/`
  - 存储层。
  - 放本地路径布局、pointer 文件、launcher state 等本地持久状态入口。
- `utils/`
  - 工具层。
  - 放无状态的辅助逻辑。
  - 当前包含版本比较，以及 bundle/update manifest 的解析与归一化工具。
- `__tests__/`
  - launcher 相关测试。
