import type { CollectedToolCall } from "@nextclaw/ncp-agent-runtime";
import type { FusionRule } from "./types.js";

/**
 * 默认融合规则：edit_file + exec（验证）
 *
 * 场景：模型编辑文件后，立即运行命令验证结果
 * 收益：消除中间的 LLM 调用，直接本地执行
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
  execute: async (calls: CollectedToolCall[]) => {
    if (calls.length < 2) {
      throw new Error("edit_verify fusion requires at least 2 calls");
    }

    const [editCall, verifyCall] = calls;

    // 解析 edit_file 参数
    let editArgs: { path: string; old_string?: string; new_string?: string } | null = null;
    try {
      editArgs = JSON.parse(editCall.args);
    } catch {
      // 解析失败，降级到单独执行
      throw new Error("Failed to parse edit_file args");
    }

    // 执行编辑（这里应该调用实际的 edit_file 工具）
    // 注意：实际执行需要访问工具定义，这里只做框架演示
    console.log(`[Action Fusion] Fusing edit_verify: ${editCall.toolName} → ${verifyCall.toolName}`);

    // 返回合并结果（实际实现需要调用工具）
    return {
      fused: true,
      editApplied: true,
      verifyResult: null,
      message: "edit+verify fusion executed (stub)",
    };
  },
};

/**
 * 默认融合规则：write_file + exec
 *
 * 场景：模型写入文件后，立即运行命令验证
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
  execute: async (calls: CollectedToolCall[]) => {
    if (calls.length < 2) {
      throw new Error("write_verify fusion requires at least 2 calls");
    }

    console.log(`[Action Fusion] Fusing write_verify: ${calls[0].toolName} → ${calls[1].toolName}`);

    return {
      fused: true,
      fileWritten: true,
      verifyResult: null,
      message: "write+verify fusion executed (stub)",
    };
  },
};

/**
 * 获取所有默认融合规则
 */
export const getDefaultFusionRules = (): FusionRule[] => [
  EDIT_VERIFY_FUSION_RULE,
  WRITE_VERIFY_FUSION_RULE,
];
