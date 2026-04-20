import type { AutomationId } from "@/types/entity-ids.types.js";
import type { AutomationRecord } from "@/types/automation.types.js";

export class AutomationManager {
  readonly listAutomations = () => {
    // TODO(kernel): return the current automation registry snapshot.
    throw new Error("AutomationManager.listAutomations is not implemented.");
  };

  readonly getAutomation = (automationId: AutomationId) => {
    // TODO(kernel): look up an automation by id.
    void automationId;
    throw new Error("AutomationManager.getAutomation is not implemented.");
  };

  readonly requireAutomation = (automationId: AutomationId) => {
    // TODO(kernel): resolve an automation and throw a domain error when missing.
    void automationId;
    throw new Error("AutomationManager.requireAutomation is not implemented.");
  };

  readonly saveAutomation = (automation: AutomationRecord) => {
    // TODO(kernel): persist automation state and schedule orchestration side effects.
    void automation;
    throw new Error("AutomationManager.saveAutomation is not implemented.");
  };

  readonly enableAutomation = (automationId: AutomationId) => {
    // TODO(kernel): enable automation execution.
    void automationId;
    throw new Error("AutomationManager.enableAutomation is not implemented.");
  };

  readonly disableAutomation = (automationId: AutomationId) => {
    // TODO(kernel): disable automation execution.
    void automationId;
    throw new Error("AutomationManager.disableAutomation is not implemented.");
  };

  readonly deleteAutomation = (automationId: AutomationId) => {
    // TODO(kernel): remove automation state and unschedule it from the runtime.
    void automationId;
    throw new Error("AutomationManager.deleteAutomation is not implemented.");
  };
}
