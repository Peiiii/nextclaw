import type { UserPublicView, UserRow } from "@/types/platform";
import { roundUsd } from "@/utils/platform.utils";

export function toUserPublicView(user: UserRow): UserPublicView {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    analyticsAudience: user.analytics_audience,
    freeLimitUsd: roundUsd(user.free_limit_usd),
    freeUsedUsd: roundUsd(user.free_used_usd),
    freeRemainingUsd: roundUsd(Math.max(0, user.free_limit_usd - user.free_used_usd)),
    paidBalanceUsd: roundUsd(user.paid_balance_usd),
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}
