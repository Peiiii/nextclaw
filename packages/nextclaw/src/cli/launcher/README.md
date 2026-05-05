# npm runtime launcher

This directory owns the npm-installed launcher host and runtime bundle update flow.

Boundaries:

- `NpmRuntimeLauncher` selects the applied runtime bundle or the packaged app entrypoint.
- Bundle layout, state, manifest parsing, download, install, activation, and command orchestration stay in explicit owner classes here.
- Shared update fields and manifest contracts belong in `@nextclaw/kernel`, not in this directory.
- User data, workspace, sessions, skills, and plugin directories are not managed here.

## 目录预算豁免

- 原因: 当前目录直接文件数到达治理上限，因为这里承载 npm 安装态 launcher host 的完整最小边界：运行时选择、bundle layout、state、manifest、下载、安装、应用切换与 CLI 编排。后续不得继续新增直接文件；若还需要增长，应先按稳定职责拆出子目录，例如 release fixture、bundle install 或 update command。
