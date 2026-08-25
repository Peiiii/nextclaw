# v0.43.1 Desktop beta 接收 stable 更新

## 迭代完成说明

修复 Desktop 选择 beta 渠道后无法发现较新 stable 版本的问题。

根因是更新源模型把“用户选择的更新策略”和“manifest 自身的发布渠道”当成同一个值：beta 客户端只请求 beta manifest，而 stable 发布只推进 stable manifest。2026-08-25 的线上事实是 darwin arm64 beta manifest 仍为 `0.22.1`，stable manifest 已为 `0.43.0`；旧单源检查以当前版本 `0.42.0` 运行时返回 `null`，确认问题发生在候选源建模，而不是版本提示 UI。

修复后 stable 策略只返回 stable source，beta 策略返回 beta 与 stable 两个 source。更新服务逐个校验 manifest 渠道、平台、架构和签名，再选择版本更高的候选；同版本优先 stable。该修复直接补齐缺失的渠道集合合同，没有在发布 workflow 复制或覆写已签名 manifest。

## 测试/验证/验收方式

- `pnpm -C apps/desktop tsc`：通过。
- Desktop 更新相关定向 ESLint：通过。
- 更新 source、渠道选优和 coordinator 共 23 项定向测试：通过。
- 使用生产公钥和线上 beta/stable manifest 运行旧单源入口：当前版本 `0.42.0` 返回 `null`，成功复现。
- 使用相同输入运行修复后的真实 coordinator：返回 `status=update-available`、`channel=beta`、`availableVersion=0.43.0`，成功验证修复。
- `pnpm lint:new-code:governance`：通过。

## 发布/部署方式

本次只完成本地源码提交，不执行 push、Desktop/NPM 发布或部署。现有 beta 安装需要后续 Desktop beta 发布或签名渠道恢复动作，才能获得新的双源检查逻辑。

## 用户/产品视角的验收步骤

1. 使用包含本修复的 NextClaw Desktop，并把更新渠道切换为 beta。
2. 保持当前 runtime 版本低于线上最新 stable。
3. 手动检查更新。
4. 应看到最新 stable 版本可用，而不是“已是最新版本”。
5. 当 beta 版本高于 stable 时，应继续提示较新的 beta，不应回退到 stable。

## 可维护性总结汇总

渠道候选集合由 `DesktopUpdateSourceService` 统一拥有，manifest 校验和版本选优由 `DesktopUpdateService` 统一拥有，coordinator 只编排检查结果，owner 边界比旧单 URL 链路更清晰。没有新增 manager、provider、fallback 或持久字段。

维护性检查无错误。首次检查发现新用例使既有 foundation test 接近文件预算，随后把渠道选优用例迁移到独立测试文件；复查时该既有文件增量为零，只保留历史基线警告。新增文件与目录治理检查通过。

## NPM 包发布记录

- 需要随后续统一版本发布：`nextclaw`。
- 当前状态：已新增 patch changeset，尚未发布。
- Desktop installer、update manifest 和渠道投影尚未发布；本次提交不包含外部发布授权。
