import { BrowserConnectorError } from "@/types/cli-output.types.js";

export type BrowserWriteAction = {
  command: string;
  reason?: string;
  confirmed?: boolean;
};

export class BrowserSecurityPolicyService {
  assertWriteAllowed = (action: BrowserWriteAction): void => {
    if (!action.reason) {
      throw new BrowserConnectorError(
        "INVALID_ARGUMENT",
        `${action.command} requires --reason so the browser action can be audited.`,
      );
    }

    if (requiresExplicitConfirmation(action.command) && !action.confirmed) {
      throw new BrowserConnectorError(
        "ACTION_REQUIRES_CONFIRMATION",
        `${action.command} requires --confirmed after explicit user approval.`,
        { recoverable: true },
      );
    }
  };
}

const requiresExplicitConfirmation = (command: string): boolean =>
  command === "page.press";
