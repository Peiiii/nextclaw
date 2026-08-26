# 发布自动化失败语义收敛

## 迭代完成说明

本轮修复了发布自动化把“仍在传播、等待或可恢复”的状态误判为失败的问题。根因是工作流和校验脚本没有统一区分三类状态：确定性合同冲突、暂时不可见、以及同一提交上已有或被取消的准备任务；同时，部分子工作流没有用不可变提交 SHA 和唯一调度标识绑定一次发布。

修复后，发布子工作流统一绑定 immutable SHA 与 dispatch ID；NPM 准备任务按 SHA 串行且不会互相取消，缺失或已取消时可重新调度；Pages、raw、registry 的临时读取错误、404、旧版本和尚未更新的 dist-tag 会在有界时间内等待重试。标签、版本、公钥、资产和不可变 manifest 字段不一致仍然立即判定为真实失败。

通过覆盖等待、恢复、超时和确定性冲突的自动化测试确认根因已被关闭，而不是仅放宽某一个报错点。

## 测试/验证/验收方式

- `node --test scripts/release/*.test.mjs`：98 项全部通过。
- 四个受影响 GitHub Actions workflow 均通过 YAML 解析。
- `node --check` 覆盖本轮修改的发布脚本，全部通过。
- `pnpm lint:new-code:governance`：通过。
- `git diff --check`：通过。
- diff-only maintainability 检查：0 error、2 个接近文件预算上限的 warning；人工复核未发现需要阻止提交的问题。
- `pnpm dev:verify-update` 已尝试真实更新链路验证，但本机 Node.js 25.6.1 与 Python 3.14 组合无法编译 `better-sqlite3`，在进入 apply 阶段前被本地原生工具链阻断；该项未宣称通过，也未遗留生成产物。

## 发布/部署方式

本轮仅提交发布自动化修复，不 push、不创建 tag、不创建 GitHub Release，也不触发 NPM、runtime 或 Desktop 发布。后续发布仍从冻结的远程 `master` 由 GitHub Actions 执行。

## 用户/产品视角的验收步骤

1. 对同一个不可变提交触发正式发布。
2. 在 Pages、raw 或 NPM registry 尚未完成传播时，确认工作流保持等待并重试，而不是立即失败。
3. 取消或缺失同 SHA 的 NPM prepare run，确认编排器重新调度并继续等待。
4. 制造标签、版本、公钥、资产或 immutable manifest 字段冲突，确认工作流仍然快速失败并给出明确错误。
5. 确认最终发布资产、NPM 包和 runtime manifest 都对应同一提交 SHA。

## 可维护性总结汇总

- 发布状态语义集中为“pending/retry、recoverable orchestration、hard failure”三类，不再由各调用点自行猜测。
- 工作流身份由分支或最新 run 收敛为 immutable SHA 与 dispatch ID，降低并发发布相互误认的风险。
- 保留确定性合同冲突的快速失败，没有用无限重试掩盖真实错误。
- 两个发布脚本已接近当前文件预算上限，但本轮人工复核认为立即拆分只会增加状态跳转；后续继续增长时应优先抽取稳定的轮询合同。
- `0.44.0` 生产发布验证发现 NPM 两个包在原 120 秒窗口后才完成公开传播；恢复运行无需重新上传即可看到 23/23 identity。默认 registry 等待窗已据此延长为 15 分钟，仍保留 integrity 冲突立即失败。

## NPM 包发布记录

不涉及 NPM 包发布。
