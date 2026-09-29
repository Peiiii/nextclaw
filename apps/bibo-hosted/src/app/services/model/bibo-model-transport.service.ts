import { logDiagnostic, type RunTrace } from "@/app/diagnostics/bibo-diagnostics.utils";

export const BIBO_DEFAULT_MODEL = "deepseek-flash";

/** The budget and upstream request are identical for the HTTP proxy and edge Agent. */
export async function forwardBiboModel(body: Record<string, unknown>, env: Env, userId: string,
  trace: RunTrace, started = Date.now(), signal?: AbortSignal): Promise<Response> {
  const model = typeof body.model === "string" ? body.model.trim().replace(/^(?:nextclaw|deepseek)\//, "") : body.model;
  if (model !== undefined && model !== BIBO_DEFAULT_MODEL) {
    logDiagnostic("model", "model.rejected", { ...trace, status: 400, errorCode: "MODEL_NOT_CONFIGURED" }, "warn");
    return Response.json({ error: { code: "MODEL_NOT_CONFIGURED", message: "Requested model is not configured for Bibo." } },
      { status: 400, headers: { "x-bibo-error-code": "MODEL_NOT_CONFIGURED" } });
  }
  const budget = env.BIBO_MODEL_BUDGET.getByName("global");
  const reservation = await budget.fetch("https://bibo.internal/reserve", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }),
  });
  if (!reservation.ok) {
    logDiagnostic("model", "model.rejected", { ...trace, status: reservation.status, errorCode: "MODEL_BUDGET_REJECTED" }, "warn");
    return new Response(reservation.body, { status: reservation.status,
      headers: { ...Object.fromEntries(reservation.headers), "x-bibo-budget-rejected": "1" } });
  }
  const upstream = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    signal,
    headers: { authorization: `Bearer ${env.BIBO_DEEPSEEK_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: BIBO_DEFAULT_MODEL,
      messages: body.messages,
      ...(Array.isArray(body.tools) ? { tools: body.tools, tool_choice: body.tool_choice ?? "auto" } : {}),
      thinking: { type: "disabled" },
      stream: body.stream === true,
      max_tokens: Math.max(1, Math.min(typeof body.max_tokens === "number" ? body.max_tokens : 2048, 2048)),
    }),
  });
  logDiagnostic("model", "model.response", { ...trace, status: upstream.status, durationMs: Date.now() - started,
    ...(!upstream.ok ? { errorCode: "MODEL_UPSTREAM_REJECTED" } : {}) }, upstream.ok ? "info" : "error");
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
  });
}
