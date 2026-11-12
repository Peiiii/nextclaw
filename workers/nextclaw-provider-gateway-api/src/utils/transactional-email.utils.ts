export type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  senderName?: string;
};

export class EmailDeliveryError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

export async function sendTransactionalEmail(
  env: { RESEND_API_KEY?: string; PLATFORM_AUTH_EMAIL_FROM?: string },
  input: TransactionalEmail,
): Promise<void> {
  const key = env.RESEND_API_KEY?.trim();
  let from = env.PLATFORM_AUTH_EMAIL_FROM?.trim();
  if (!key || !from) throw new EmailDeliveryError(503, "EMAIL_PROVIDER_NOT_CONFIGURED", "Resend email provider is not fully configured.");
  if (!input || typeof input.to !== "string" || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(input.to) || input.to.length > 254
    || typeof input.subject !== "string" || !input.subject.trim() || input.subject.length > 200 || /[\r\n]/.test(input.subject)
    || typeof input.text !== "string" || !input.text || input.text.length > 20_000
    || typeof input.html !== "string" || !input.html || input.html.length > 50_000) {
    throw new EmailDeliveryError(400, "INVALID_EMAIL", "Invalid transactional email.");
  }
  if (input.senderName !== undefined) {
    if (typeof input.senderName !== "string" || !input.senderName.trim() || input.senderName.length > 40 || /[\r\n<>"\\]/.test(input.senderName)) throw new EmailDeliveryError(400, "INVALID_SENDER", "Invalid sender name.");
    const address = from.match(/<([^<>]+)>$/)?.[1] ?? from;
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) throw new EmailDeliveryError(503, "EMAIL_PROVIDER_NOT_CONFIGURED", "Email sender is not configured.");
    from = `${input.senderName.trim()} <${address}>`;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html, text: input.text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new EmailDeliveryError(502, "EMAIL_DELIVERY_FAILED", `Email delivery failed (${response.status}).`);
}
