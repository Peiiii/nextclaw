## 目录结构
- `ncp/` 根目录只保留运行时装配主入口与少量核心状态 owner。
- 兼容性测试、上下文拼装、provider 适配、runtime 辅助与 session 支撑逻辑分别下沉到 `compat/`、`context/`、`provider/`、`runtime/`、`session/` 子目录；其中 `compat/` 是 `ncp/` 内部子目录，不再在 `commands/` 根层单独存在。
