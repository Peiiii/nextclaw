import { useServiceActionAuthorizationStore } from '@/features/service-apps/stores/service-action-authorization.store';
import type { ServiceActionAuthorizationRequest } from '@/features/service-apps/stores/service-action-authorization.store';

export class ServiceActionAuthorizationManager {
  requestAuthorization = async (
    request: Omit<ServiceActionAuthorizationRequest, 'id'>,
  ): Promise<boolean> => {
    return await useServiceActionAuthorizationStore.getState().requestAuthorization(request);
  };
}
