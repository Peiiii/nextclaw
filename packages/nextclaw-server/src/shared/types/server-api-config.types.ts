export type ProductAnalyticsStatusView = {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  pendingReceiptCount: number;
};
