import type { AutomationId } from "@/types/entity-ids.types.js";
import type { AutomationRecord } from "@/types/automation.types.js";

export abstract class AutomationManager {
  abstract listAutomations(): AutomationRecord[];
  abstract getAutomation(automationId: AutomationId): AutomationRecord | null;
  abstract requireAutomation(automationId: AutomationId): AutomationRecord;
  abstract saveAutomation(automation: AutomationRecord): void;
  abstract enableAutomation(automationId: AutomationId): void;
  abstract disableAutomation(automationId: AutomationId): void;
  abstract deleteAutomation(automationId: AutomationId): void;
}
