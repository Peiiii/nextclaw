import type { AutomationId } from "@/types/entity-ids.types.js";
import type { AutomationRecord } from "@/types/automation.types.js";

export class AutomationManager {
  readonly listAutomations = () => {
    throw new Error("AutomationManager.listAutomations is not implemented.");
  };

  readonly getAutomation = (automationId: AutomationId) => {
    void automationId;
    throw new Error("AutomationManager.getAutomation is not implemented.");
  };

  readonly requireAutomation = (automationId: AutomationId) => {
    void automationId;
    throw new Error("AutomationManager.requireAutomation is not implemented.");
  };

  readonly saveAutomation = (automation: AutomationRecord) => {
    void automation;
    throw new Error("AutomationManager.saveAutomation is not implemented.");
  };

  readonly enableAutomation = (automationId: AutomationId) => {
    void automationId;
    throw new Error("AutomationManager.enableAutomation is not implemented.");
  };

  readonly disableAutomation = (automationId: AutomationId) => {
    void automationId;
    throw new Error("AutomationManager.disableAutomation is not implemented.");
  };

  readonly deleteAutomation = (automationId: AutomationId) => {
    void automationId;
    throw new Error("AutomationManager.deleteAutomation is not implemented.");
  };
}
