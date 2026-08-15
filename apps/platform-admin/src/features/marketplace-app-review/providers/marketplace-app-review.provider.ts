import {
  fetchAdminMarketplaceAppDetail as fetchMarketplaceAppDetail,
  reviewAdminMarketplaceApp as reviewMarketplaceApp,
} from '@/api/client';
import type { AdminMarketplaceAppReviewStatus } from '@/api/types';
import type {
  AdminMarketplaceAppCatalogVisibility,
  AdminMarketplaceAppDetailPayload,
  AdminMarketplaceAppDetailView,
} from '@/features/marketplace-app-review/types/marketplace-app-review.types';

export async function fetchAdminMarketplaceAppDetail(
  token: string,
  selector: string,
): Promise<AdminMarketplaceAppDetailPayload> {
  return await fetchMarketplaceAppDetail(token, selector) as AdminMarketplaceAppDetailPayload;
}

export async function reviewAdminMarketplaceApp(
  token: string,
  selector: string,
  payload: {
    publishStatus: AdminMarketplaceAppReviewStatus;
    catalogVisibility?: AdminMarketplaceAppCatalogVisibility;
    reviewNote?: string;
  },
): Promise<{ item: AdminMarketplaceAppDetailView }> {
  return await reviewMarketplaceApp(token, selector, payload) as {
    item: AdminMarketplaceAppDetailView;
  };
}
