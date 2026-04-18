import type {
  ApiEnvelope,
  OwnerMarketplaceSkillDetailView,
  OwnerMarketplaceSkillListView,
  OwnerMarketplaceSkillManageAction,
} from '@/api/types';
import { request, unwrap } from '@/api/client';

export async function fetchOwnerMarketplaceSkills(
  token: string,
  options: { q?: string } = {}
): Promise<OwnerMarketplaceSkillListView> {
  const params = new URLSearchParams();
  if (options.q && options.q.trim().length > 0) {
    params.set('q', options.q.trim());
  }
  const suffix = params.toString();
  const data = await request<ApiEnvelope<OwnerMarketplaceSkillListView>>(
    suffix ? `/platform/marketplace/skills?${suffix}` : '/platform/marketplace/skills',
    {},
    token
  );
  return unwrap(data);
}

export async function fetchOwnerMarketplaceSkillDetail(
  token: string,
  selector: string
): Promise<OwnerMarketplaceSkillDetailView> {
  const data = await request<ApiEnvelope<OwnerMarketplaceSkillDetailView>>(
    `/platform/marketplace/skills/${encodeURIComponent(selector)}`,
    {},
    token
  );
  return unwrap(data);
}

export async function manageOwnerMarketplaceSkill(
  token: string,
  selector: string,
  action: OwnerMarketplaceSkillManageAction
): Promise<{ item: OwnerMarketplaceSkillDetailView }> {
  const data = await request<ApiEnvelope<{ item: OwnerMarketplaceSkillDetailView }>>(
    `/platform/marketplace/skills/${encodeURIComponent(selector)}/manage`,
    {
      method: 'POST',
      body: JSON.stringify({ action })
    },
    token
  );
  return unwrap(data);
}
