import type { CollectedToolCall } from "@nextclaw/ncp-agent-runtime";
import type {
  ActionFusionConfig,
  ActionFusionContext,
  ActionFusionResult,
  FusionRule,
} from "./types.js";
export type { ActionFusionContext } from "./types.js";

/**
 * Action Fusion 服务
 *
 * 核心功能：检测连续工具调用序列，判断是否匹配已知融合规则，
 * 如果匹配则合并执行，节省中间 LLM 调用。
 */
export class ActionFusionService {
  private readonly config: ActionFusionConfig;
  /** 内部状态：跟踪当前活跃的融合调用序列 */
  private currentFusion: {
    rule: FusionRule;
    calls: CollectedToolCall[];
  } | null = null;

  constructor(config: ActionFusionConfig) {
    this.config = config;
  }

  /**
   * 检测并融合下一个工具调用
   */
  detectAndFuse = async (
    context: ActionFusionContext,
    nextCall: CollectedToolCall,
  ): Promise<ActionFusionResult> => {
    if (!this.config.enabled) {
      // 禁用时直接返回，不执行任何操作
      return { fused: false, fusedCallCount: 0, savedCalls: 0 };
    }

    // 查找匹配的融合规则
    const matchingRule = this.findMatchingRule(this.currentFusion?.rule, nextCall);

    if (!matchingRule) {
      // 没有匹配规则，重置状态并单独执行
      this.currentFusion = null;
      return await this.executeWithoutFusion(context, nextCall);
    }

    // 构建融合调用序列
    const existingCalls = this.currentFusion?.calls ?? [];
    const allCalls = [...existingCalls, nextCall];

    // 检查是否超出最大深度
    if (allCalls.length > matchingRule.maxDepth) {
      // 超出深度限制，执行已有调用（如果够融合）或单独执行
      if (existingCalls.length >= 2) {
        this.currentFusion = { rule: matchingRule, calls: existingCalls };
        return await this.executeFusion(context, existingCalls, matchingRule);
      }
      this.currentFusion = null;
      return await this.executeWithoutFusion(context, nextCall);
    }

    // 检查是否匹配模式
    if (!this.matchesPattern(allCalls, matchingRule.pattern)) {
      // 模式不匹配，重置并单独执行
      this.currentFusion = null;
      return await this.executeWithoutFusion(context, nextCall);
    }

    // 更新内部状态
    this.currentFusion = { rule: matchingRule, calls: allCalls };

    // 如果调用序列足够长（>=2），执行融合
    if (allCalls.length >= 2) {
      return await this.executeFusion(context, allCalls, matchingRule);
    }

    // 还不够融合，继续等待
    return { fused: false, fusedCallCount: 0, savedCalls: 0 };
  };

  /**
   * 查找匹配的融合规则
   */
  private findMatchingRule = (
    currentRule: FusionRule | undefined,
    nextCall: CollectedToolCall,
  ): FusionRule | null => {
    for (const rule of this.config.rules) {
      // 检查是否应该应用此规则
      if (rule.shouldFuse && !rule.shouldFuse(
        this.currentFusion?.calls ?? [],
        nextCall,
      )) {
        continue;
      }

      // 检查是否延续当前规则或启动新规则
      const isContinuation = currentRule === rule;
      const isNewStart = !currentRule && this.matchesPatternStart(rule, nextCall);

      if (isContinuation || isNewStart) {
        return rule;
      }
    }
    return null;
  };

  /**
   * 检查是否匹配规则起始
   */
  private matchesPatternStart = (rule: FusionRule, call: CollectedToolCall): boolean => {
    return rule.pattern.length > 0 && call.toolName === rule.pattern[0];
  };

  /**
   * 检查调用序列是否匹配模式
   */
  private matchesPattern = (
    calls: CollectedToolCall[],
    pattern: string[],
  ): boolean => {
    if (calls.length > pattern.length) {
      return false;
    }

    for (let i = 0; i < calls.length; i++) {
      if (calls[i].toolName !== pattern[i]) {
        return false;
      }
    }

    return true;
  };

  /**
   * 执行融合
   */
  private executeFusion = async (
    context: ActionFusionContext,
    calls: CollectedToolCall[],
    rule: FusionRule,
  ): Promise<ActionFusionResult> => {
    try {
      const result = await rule.execute(calls, context);
      // 融合成功，重置状态
      this.currentFusion = null;

      console.log(`[Action Fusion] Fused ${calls.length} calls with rule "${rule.name}"`);

      return {
        fused: true,
        result,
        fusedCallCount: calls.length,
        savedCalls: calls.length - 1,
      };
    } catch (error) {
      // 融合失败，降级到单独执行第一个调用
      console.warn(`Action Fusion failed for rule "${rule.name}", falling back:`, error);
      this.currentFusion = null;

      const firstCall = calls[0];
      const firstResult = await context.originalExecuteToolCall(firstCall, context.publishToolEvent);

      return {
        fused: false,
        result: firstResult,
        fusedCallCount: 1,
        savedCalls: 0,
      };
    }
  };

  /**
   * 不融合时直接执行
   */
  private executeWithoutFusion = async (
    context: ActionFusionContext,
    call: CollectedToolCall,
  ): Promise<ActionFusionResult> => {
    const result = await context.originalExecuteToolCall(call, context.publishToolEvent);
    return {
      fused: false,
      result,
      fusedCallCount: 1,
      savedCalls: 0,
    };
  };

  /**
   * 重置融合状态
   */
  reset = (): void => {
    this.currentFusion = null;
  };
}
