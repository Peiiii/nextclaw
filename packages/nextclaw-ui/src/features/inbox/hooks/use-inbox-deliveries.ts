import { useQuery } from "@tanstack/react-query";
import { INBOX_DELIVERIES_QUERY_KEY } from "@/features/inbox/managers/inbox.manager";
import { nextclawClient } from "@/shared/lib/api";

export function useInboxDeliveries() {
  return useQuery({
    queryKey: INBOX_DELIVERIES_QUERY_KEY,
    queryFn: () => nextclawClient.inboxDeliveries.list(),
  });
}

export function useInboxUnreadCount(): number {
  return useInboxDeliveries().data?.unreadCount ?? 0;
}
