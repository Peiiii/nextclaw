# Portable Runtime 自愈与发布闭环计划

## 目标与上位设计

按 [Portable Runner 发布完整性设计](../designs/2026-08-29-portable-runner-release-integrity.design.md) 修复公开 NPM 安装“版本已更新但当前平台 runner 缺失”的通用问题，并以 patch 版本完成三平台发布和 Linux 实机验收。

范围包括 launcher 自愈、版本/输出合同、真实 HTTP 启用发布门、线上恢复和 patch 发布。非目标是更换 WASM 技术栈、引入 optional NPM native packages、重做 App 生命周期或处理没有证据关联的 Node 原生依赖升级。

## 执行部分

### 1. 冻结失败基线与 launcher 自愈合同

- Owner：`@nextclaw/service` 的 launcher、runtime bundle 与 update manager。
- 输入：公开 `0.45.1` tarball 缺 runner、旧完整 bundle 被不完整 packaged runtime 遮盖、同版本不再下载的复现。
- 交付：先写失败回归，再让完整性参与选择和版本比较；缺完整目标时复用现有签名 updater 在启动前 bootstrap，成功后从 pointer 启动。
- 验证：全新安装、旧 bundle + 新 launcher、同版本完整 bundle、离线回退、beta→stable、应用输出目标版本。
- 设计策略：复用上位设计；若实现证明必须新增持久状态或第二个下载 owner，返回 Design，不在实现中扩张。

### 2. 补齐真实产品链与三平台发布门

- Owner：现有 portable runtime workflow 和 published runtime verifier。
- 输入：当前只验证 runner 文件和 direct `counter_read` 的缺口。
- 交付：统一 helper 启动真实服务，经 HTTP 启用日常小工具箱并调用 action；Linux x64、Windows x64、macOS arm64 并行执行同一合同，Linux 增加 ABI/执行位和受限内存证据。
- 验证：矩阵三个 job 全部通过，失败返回结构化 JSON；服务 PID 在 enable 前后仍存活，provider/resident 已启动。
- 设计策略：轻量内联复用现有 verifier，不新增第二套 demo 或独立 smoke 产品。

### 3. Review、patch 发布与 Linux 实机闭环

- Owner：通用开发 Review/Delivery；发布继续走一次 `target=all` 自动化主链。
- 输入：前两部分通过的冻结 commit。
- 交付：维护性检查、精确 changeset/迭代记录/用户文档、patch NPM/runtime/Desktop 发布；不分别手工重复发布。
- 验证：公开 NPM、三平台 runtime manifests/ZIP、Desktop assets/manifests/APT、文档和 master 回流；受影响 Linux 服务器从公开 patch 自愈，runner 存在且可执行，真实 HTTP enable 返回 JSON 2xx，代表性 action、provider、resident 正常，Nginx/systemd 无新增 502/OOM。
- 设计策略：复用上位设计；若现场证明另有 glibc 或 OOM 根因，先回到 Design 补充同类用户的最小完整范围，再继续发布。

## 中断与恢复入口

恢复时先读取本计划和上位设计，再检查当前分支、最后一个失败回归、CI run 与发布 checkpoint。已证明成功的公开产物和平台结果不重复验证；只从第一个未成立的交付边界继续。远程凭据只从私有环境条目交互使用，不写入计划、日志或命令输出。
