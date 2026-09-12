import type { ContextBlock, ContextProvider } from "@kernel/types/agent-run.types.js";
import type { ConfigManager } from "@kernel/managers/config.manager.js";

/**
 * PartnershipContextProvider：根据 agents.partnershipMode 注入搭档身份与授权语义。
 *
 * 模式说明：
 * - off：被动响应，不主动发起任何参与
 * - observe：观察、分析、报告，不采取行动
 * - analyze：识别机会与冲突，提出规划和讨论问题
 * - assist：在 routine 之外先建议再执行（默认）
 * - execute：在预授权范围内自主行动
 */
export class PartnershipContextProvider implements ContextProvider {
  constructor(private readonly configManager: ConfigManager) {}

  provide = async (): Promise<readonly ContextBlock[]> => {
    const mode = this.configManager.loadConfig().agents.partnershipMode;
    if (mode === "off" || mode === "assist") {
      // off 和 assist 不需要额外注入（assist 是默认行为）
      return [];
    }
    return [this.buildBlock(mode)];
  };

  private buildBlock = (mode: string): ContextBlock => {
    const instructions: Record<string, string> = {
      observe: [
        "## Partnership Mode: Observe",
        "You are in observation mode. Watch, analyze, and report what you see — never act without explicit permission.",
        "- Do NOT execute tools, send messages, or modify files unless the user explicitly asks.",
        "- You MAY surface observations, flag potential issues, and suggest what COULD be done.",
        "- When something needs action, phrase it as a question: \"Would you like me to ...?\"",
        "- Your value is in noticing patterns and raising signals, not in acting on them.",
      ].join("\n"),
      analyze: [
        "## Partnership Mode: Analyze",
        "You are in analysis mode. Identify opportunities, conflicts, and patterns; propose plans and discussion questions.",
        "- You MAY analyze context, compare options, and surface findings.",
        "- You MAY propose concrete plans or next steps, but DO NOT execute them without confirmation.",
        "- Frame proposals as suggestions: \"Here's what I think could work ... Should we proceed?\"",
        "- Avoid acting on your own analysis — your role is to inform decisions, not make them.",
      ].join("\n"),
      execute: [
        "## Partnership Mode: Execute",
        "You are in execution mode. Act autonomously within pre-authorized boundaries.",
        "- Safe, routine actions (file organization, scheduled checks, housekeeping) may proceed without asking.",
        "- Non-routine actions, external communications, or anything irreversible still require confirmation.",
        "- When uncertain whether an action is authorized, ask before doing it.",
        "- Report completed actions briefly so the user retains visibility.",
      ].join("\n"),
    };
    return (instructions[mode] ?? "") as ContextBlock;
  };
}
