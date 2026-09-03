import { usePanelAppServiceActionAuthorizationStore } from '@/features/panel-apps/stores/panel-app-service-action-authorization.store';
import type { PanelAppServiceActionAuthorizationRequest } from '@/features/panel-apps/stores/panel-app-service-action-authorization.store';

export class PanelAppServiceActionAuthorizationManager {
  requestAuthorization = async (
    request: Omit<PanelAppServiceActionAuthorizationRequest, 'id'>,
  ): Promise<boolean> => {
    return await usePanelAppServiceActionAuthorizationStore.getState().requestAuthorization(request);
  };
}
