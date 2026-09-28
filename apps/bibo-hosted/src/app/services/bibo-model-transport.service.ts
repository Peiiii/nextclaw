import { logDiagnostic, type RunTrace } from "../diagnostics/bibo-diagnostics.utils";

/** The budget and upstream request are identical for the HTTP proxy and edge Agent. */
export async function forwardBiboModel(body: Record<string, unknown>, env: Env, userId: string,
  trace: RunTrace, started = Date.now(), signal?: AbortSignal): Promise<Response> {
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
      model: "deepseek-flash",
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
