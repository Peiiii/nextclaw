import { PanelAppBridgeManager } from "@/features/panel-apps/managers/panel-app-bridge.manager";
import { PanelAppServiceActionAuthorizationManager } from "@/features/panel-apps/managers/panel-app-service-action-authorization.manager";

export class PanelAppHostPresenter {
  readonly serviceActionAuthorizationManager = new PanelAppServiceActionAuthorizationManager();
  readonly panelAppBridgeManager = new PanelAppBridgeManager(
    this.serviceActionAuthorizationManager,
  );
}
