# Goal Progress

- 目标：落地 session journal-first 持久化，保留半截消息可恢复，并避免工具执行期间普通 API 被 legacy 同步全量 session save 拖住。
- 非目标：不恢复 OS tool process；不做多进程同 session 写入仲裁；不在本轮完成大 payload artifact 化。
- 当前状态：核心实现已追加删除旧 snapshot 热路径；append-only contract 不再携带完整 messages；历史 legacy 会话消息 fallback 与首次 journal seed 已修复，并用真实接口验证 `ncp-mp4alqjo-e3c666c3` 返回 2 条历史消息。
- 已知阻塞：全量 governance / maintainability guard 被工作区内无关 extension runtime mapper / bridge 改动阻塞，需要单独处理或隔离后重跑。
- 锚点：19/20。
