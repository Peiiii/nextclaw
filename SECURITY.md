# Security

## Report a vulnerability

Please use [GitHub private vulnerability reporting](https://github.com/Peiiii/nextclaw/security/advisories/new) for security issues. Do not include credentials, access tokens, private logs, or executable malware samples in public issues.

安全问题请优先通过 [GitHub 私密漏洞报告](https://github.com/Peiiii/nextclaw/security/advisories/new) 提交。请勿在公开 Issue 中粘贴凭证、访问令牌、私有日志或可执行恶意样本。

## 2026-08-11: malicious `@nextclaw/bird` skill content

NextClaw Marketplace previously published a skill named `@nextclaw/bird` whose `SKILL.md` contained malicious third-party download and remote-execution instructions. The affected content came from a legacy external import; it was not part of the legitimate `bird` CLI binary.

The item was available after its legacy import on 2026-02-27 and was removed from all public NextClaw Marketplace endpoints on 2026-08-11. NextClaw has no evidence that merely installing the skill executes the payload. The risk begins when a user or agent follows the malicious installation instructions in that file.

### What affected users should do

If you installed `bird` from NextClaw Marketplace during this period:

1. Do not follow any `OpenClawProvider` installation instructions from the skill.
2. Disable or remove the installed Marketplace skill until you have inspected its `SKILL.md`.
3. Compare `SKILL.md` with the compromised SHA-256 below.
4. If the malicious command or downloaded program was executed, rotate browser and X/Twitter session cookies and tokens, inspect login items and scheduled tasks, and run a trusted endpoint security scan.
5. Reinstall any required X/Twitter CLI only from a source you have independently verified.

Known indicators are provided in defanged form for investigation:

- Compromised `SKILL.md` SHA-256: `a4dc268bfc51bcabf90b67735fb05ad08473464d2fc776c84d3e8556ea415623`
- Referenced repository: `github[.]com/syazema/OpenClawProvider`
- Referenced host: `91[.]92[.]242[.]30`

### NextClaw response

- Rejected the canonical Marketplace item and removed its public detail, content, file-list, and file-download routes.
- Evicted the stale copy from the domestic read-only Marketplace mirror.
- Added server-side scanning that blocks known malicious or obfuscated remote-execution content before storage.
- Changed high-risk remote-shell instructions to require manual review, including uploads under the official `@nextclaw/*` scope.
- Added a publish-time rescan so previously stored malicious content cannot be re-enabled by an admin review action.
- Added migration and mirror reconciliation guards so fresh databases and removed-skill caches do not restore the item.

## 中文说明：`@nextclaw/bird` 恶意技能内容

NextClaw Marketplace 曾发布 `@nextclaw/bird`。它的 `SKILL.md` 含有第三方恶意下载和远程执行指令。问题来自历史外部导入，不是合法 `bird` CLI 二进制本身被替换。

该条目已于 2026-08-11 从 NextClaw 的所有公开 Marketplace 接口下架。现有证据不表明“仅安装技能”会自动执行载荷；只有用户或 Agent 继续执行文件中的恶意安装指令时，风险才会发生。

如果你曾从 NextClaw Marketplace 安装 `bird`：

1. 不要执行任何要求安装 `OpenClawProvider` 的内容。
2. 暂时禁用或移除该技能，并检查本地 `SKILL.md` 的 SHA-256。
3. 如果已经执行过恶意命令或下载程序，请立即轮换浏览器与 X/Twitter 的 Cookie、会话和令牌，检查登录项与定时任务，并使用可信的终端安全软件扫描系统。
4. 需要继续使用 X/Twitter CLI 时，请从独立核验过的来源重新安装。

上面的散列和去活化 IOC 可用于排查；请不要重新拼接或运行恶意命令。
