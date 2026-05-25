export type ChannelAuthStartRequest = {
  accountId?: string;
  baseUrl?: string;
  domain?: string;
};

export type ChannelAuthConnectRequest = {
  accountId?: string;
  domain?: string;
  fields?: Record<string, unknown>;
};

export type ChannelAuthStartResult = {
  channel: string;
  kind: "qr_code";
  sessionId: string;
  qrCode: string;
  qrCodeUrl: string;
  expiresAt: string;
  intervalMs: number;
  note?: string;
};

export type ChannelAuthPollRequest = {
  sessionId: string;
};

export type ChannelAuthPollResult = {
  channel: string;
  status: "pending" | "scanned" | "authorized" | "expired" | "error";
  message?: string;
  nextPollMs?: number;
  accountId?: string | null;
  notes?: string[];
};

export type ChannelAuthConnectResult = ChannelAuthPollResult;
