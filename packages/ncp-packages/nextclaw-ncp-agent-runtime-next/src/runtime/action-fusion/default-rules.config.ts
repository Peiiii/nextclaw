import type { CollectedToolCall } from "@nextclaw/ncp-agent-runtime";
import type { NcpEndpointEvent } from "@nextclaw/ncp";
import type { ActionFusionContext, FusionRule } from "./types.js";

/**
 * 顺序真实执行融合序列：每个调用通过原始执行器运行，
 * 除最后一个外的结果事件立即发布，最后一个返回给运行时。
 */
async function executeCallsSequentially(
  calls: CollectedToolCall[],
  context: ActionFusionContext,
): Promise<unknown> {
  if (calls.length < 2) {
    throw new Error("fusion sequence requires at least 2 calls");
  }
  let lastResult: unknown;
  for (let index = 0; index < calls.length; index += 1) {
    const call = calls[index]!;
    const result = await context.originalExecuteToolCall(call, context.publishToolEvent);
    if (index < calls.length - 1) {
      await context.publishToolEvent(result as NcpEndpointEvent);
    }
    lastResult = result;
  }
  return lastResult;
}

/**
 * 默认融合规则：edit_file + exec（验证）
 *
 * 场景：模型在同一轮发出编辑文件与验证命令时，本地顺序真实执行两者，
 * 编辑结果事件照常入会话，模型下一轮直接拿到验证结果。
 */
export const EDIT_VERIFY_FUSION_RULE: FusionRule = {
  name: "edit_verify",
  pattern: ["edit_file", "exec"],
  maxDepth: 2,
  shouldFuse: (calls, nextCall) => {
    // 只融合 edit_file 后紧跟 exec 的场景
    if (calls.length === 0 && nextCall?.toolName === "edit_file") {
      return true;
    }
    if (calls.length === 1 && calls[0].toolName === "edit_file" && nextCall?.toolName === "exec") {
      return true;
    }
    return false;
  },
  execute: executeCallsSequentially,
};

/**
 * 默认融合规则：write_file + exec
 *
 * 场景：模型在同一轮发出写文件与验证命令时，本地顺序真实执行两者。
 */
export const WRITE_VERIFY_FUSION_RULE: FusionRule = {
  name: "write_verify",
  pattern: ["write_file", "exec"],
  maxDepth: 2,
  shouldFuse: (calls, nextCall) => {
    if (calls.length === 0 && nextCall?.toolName === "write_file") {
      return true;
    }
    if (calls.length === 1 && calls[0].toolName === "write_file" && nextCall?.toolName === "exec") {
      return true;
    }
    return false;
  },
  execute: executeCallsSequentially,
};

/**
 * 获取所有默认融合规则
 */
export const getDefaultFusionRules = (): FusionRule[] => [
  EDIT_VERIFY_FUSION_RULE,
  WRITE_VERIFY_FUSION_RULE,
];
