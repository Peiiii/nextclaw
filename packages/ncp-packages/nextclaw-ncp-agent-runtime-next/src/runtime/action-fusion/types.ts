import type { CollectedToolCall } from "@nextclaw/ncp-agent-runtime";
import type { NcpEndpointEvent } from "@nextclaw/ncp";

/**
 * Action Fusion 规则定义
 */
export type FusionRule = {
  /** 规则名称（用于日志和调试） */
  name: string;
  /** 工具调用序列模式，如 ["edit_file", "exec"] */
  pattern: string[];
  /** 最大连续调用深度 */
  maxDepth: number;
  /** 执行合并的工具调用序列 */
  execute: (calls: CollectedToolCall[]) => Promise<unknown>;
  /**
   * 可选：验证是否应该应用此规则
   * 默认为 true（总是应用）
   */
  shouldFuse?: (calls: CollectedToolCall[], nextCall?: CollectedToolCall) => boolean;
};

/**
 * Action Fusion 配置
 */
export type ActionFusionConfig = {
  /** 是否启用 Action Fusion（默认 false，保持现状行为） */
  enabled: boolean;
  /** 注册的融合规则列表 */
  rules: FusionRule[];
  /** 最大连续检测窗口（防止无限等待） */
  maxLookahead: number;
};

/**
 * Action Fusion 上下文
 */
export type ActionFusionContext = {
  /** 当前会话 ID */
  sessionId: string;
  /** 当前消息 ID */
  messageId: string;
  /** 当前 correlation ID */
  correlationId?: string;
  /** 发布工具事件回调 */
  publishToolEvent: (event: NcpEndpointEvent) => Promise<void>;
  /** 原始工具执行函数 */
  originalExecuteToolCall: (
    toolCall: CollectedToolCall,
    publishToolEvent: (event: NcpEndpointEvent) => Promise<void>,
  ) => Promise<unknown>;
  /** 当前活跃的融合调用队列 */
  activeFusion?: ActiveFusionCall;
};

/**
 * 正在执行的融合调用
 */
export type ActiveFusionCall = {
  rule: FusionRule;
  calls: CollectedToolCall[];
  startedAt: number;
};

/**
 * Action Fusion 结果
 */
export type ActionFusionResult = {
  /** 是否有匹配的融合规则 */
  fused: boolean;
  /** 融合后的结果 */
  result?: unknown;
  /** 被融合的工具调用数量 */
  fusedCallCount: number;
  /** 节省的 LLM 调用次数估算 */
  savedCalls: number;
};
