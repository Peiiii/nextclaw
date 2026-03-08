import type { Context } from "hono";
import { appendProfitLedger, listRuntimeModelSpecs, readBillingSnapshot } from "../repositories/platform-repository";
import { chargeFromStream, chargeUsage, computeChargeSplit, ensurePlatformBootstrap, requireAuthUser } from "../services/platform-service";
import {
  MODEL_MAP,
  SUPPORTED_MODELS,
  type BillingSnapshot,
  type ChatCompletionRequest,
  type Env,
  type RuntimeModelSpec,
  type SupportedModelSpec
} from "../types/platform";
import {
  extractUsageCounters,
  getDashscopeApiBase,
  getRequestFlatUsdPerRequest,
  normalizeIdempotencyKey,
  openaiError,
  resolveMaxCompletionTokens,
  roundUsd,
  sanitizeResponseHeaders,
  withTrailingSlash,
  estimateUsage
} from "../utils/platform-utils";

export async function healthHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  return c.json({
    ok: true,
    data: {
      status: "ok",
      service: "nextclaw-provider-gateway-api",
      authRequired: true,
      billingMode: "usd-only"
    }
  });
}

export async function modelsHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const modelSpecs = await resolveRuntimeModelSpecs(c.env);
  return c.json({
    object: "list",
    data: modelSpecs.map((model) => ({
      id: model.id,
      object: "model",
      created: 0,
      owned_by: "nextclaw",
      display_name: model.displayName
    }))
  });
}

export async function usageHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const snapshot = await readBillingSnapshot(c.env.NEXTCLAW_PLATFORM_DB, auth.user.id);
  if (!snapshot) {
    return openaiError(c, 404, "User not found.", "user_not_found");
  }

  return c.json({
    object: "nextclaw.usage",
    data: {
      totalCostUsd: roundUsd(snapshot.user.free_used_usd + Math.max(0, snapshot.user.paid_balance_usd)),
      freeQuotaUsdLimit: roundUsd(snapshot.user.free_limit_usd),
      freeQuotaUsdUsed: roundUsd(snapshot.user.free_used_usd),
      freeQuotaUsdRemaining: roundUsd(Math.max(0, snapshot.user.free_limit_usd - snapshot.user.free_used_usd)),
      paidBalanceUsd: roundUsd(snapshot.user.paid_balance_usd),
      globalFreeUsdLimit: roundUsd(snapshot.globalFreeLimitUsd),
      globalFreeUsdUsed: roundUsd(snapshot.globalFreeUsedUsd),
      globalFreeUsdRemaining: roundUsd(Math.max(0, snapshot.globalFreeLimitUsd - snapshot.globalFreeUsedUsd)),
      updatedAt: snapshot.user.updated_at
    }
  });
}

export async function chatCompletionsHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);

  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  let body: ChatCompletionRequest;
  try {
    body = await c.req.json<ChatCompletionRequest>();
  } catch {
    return openaiError(c, 400, "Invalid JSON payload.", "invalid_request_error");
  }

  if (typeof body.model !== "string" || body.model.trim().length === 0) {
    return openaiError(c, 400, "model is required.", "invalid_request_error");
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return openaiError(c, 400, "messages must be a non-empty array.", "invalid_request_error");
  }

  const requestedModel = body.model.trim();
  const runtimeModelSpecs = await resolveRuntimeModelSpecs(c.env);
  const runtimeModelMap = new Map(runtimeModelSpecs.map((model) => [model.id, model]));
  const runtimeModelSpec = runtimeModelMap.get(requestedModel);
  const fallbackModelSpec = MODEL_MAP.get(requestedModel);
  if (!runtimeModelSpec && !fallbackModelSpec) {
    return openaiError(
      c,
      400,
      `Model '${requestedModel}' is not available in NextClaw catalog.`,
      "model_not_found"
    );
  }
  const resolvedModelSpec = runtimeModelSpec ?? toStaticRuntimeModelSpec(fallbackModelSpec!, c.env);

  if (!resolvedModelSpec.accessToken || resolvedModelSpec.accessToken.trim().length === 0) {
    return openaiError(c, 503, "Upstream provider is not configured.", "service_unavailable");
  }

  const usageEstimate = estimateUsage(body.messages, resolveMaxCompletionTokens(body));
  const estimatedCost = calculateUsageUsd(usageEstimate, resolvedModelSpec.sellInputUsdPer1M, resolvedModelSpec.sellOutputUsdPer1M) +
    getRequestFlatUsdPerRequest(c.env);

  const precheckSnapshot = await readBillingSnapshot(c.env.NEXTCLAW_PLATFORM_DB, auth.user.id);
  if (!precheckSnapshot) {
    return openaiError(c, 404, "User not found.", "user_not_found");
  }

  const precheckSplit = computeChargeSplit(precheckSnapshot, estimatedCost);
  if (!precheckSplit) {
    return insufficientQuotaPrecheckResponse(c, precheckSnapshot);
  }

  const upstreamUrl = new URL("chat/completions", withTrailingSlash(resolvedModelSpec.apiBase)).toString();
  const upstreamPayload: Record<string, unknown> = {
    ...body,
    model: resolvedModelSpec.upstreamModel
  };

  const upstreamResponse = await fetch(upstreamUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolvedModelSpec.accessToken.trim()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(upstreamPayload)
  });

  const idempotencyKey = normalizeIdempotencyKey(c.req.header("x-idempotency-key"));
  const requestId = idempotencyKey
    ? `chat:${auth.user.id}:${idempotencyKey}`
    : crypto.randomUUID();

  const billingModelSpec = toBillingModelSpec(resolvedModelSpec);

  if (body.stream === true && upstreamResponse.body) {
    const [clientStream, billingStream] = upstreamResponse.body.tee();
    if (upstreamResponse.ok) {
      c.executionCtx.waitUntil(
        chargeFromStream({
          env: c.env,
          userId: auth.user.id,
          modelSpec: billingModelSpec,
          stream: billingStream,
          fallback: usageEstimate,
          requestId,
          onSettled: async ({ usage, result }) => {
            if (!result.ok) {
              return;
            }
            await appendProfitLedger(c.env.NEXTCLAW_PLATFORM_DB, {
              requestId,
              userId: auth.user.id,
              publicModelId: resolvedModelSpec.id,
              providerAccountId: resolvedModelSpec.providerAccountId,
              upstreamModel: resolvedModelSpec.upstreamModel,
              chargeUsd: result.split.totalCostUsd,
              upstreamCostUsd: calculateUpstreamCostUsd(usage, resolvedModelSpec),
              grossMarginUsd: roundUsd(
                result.split.totalCostUsd - calculateUpstreamCostUsd(usage, resolvedModelSpec)
              )
            });
          }
        })
      );
    }
    return new Response(clientStream, {
      status: upstreamResponse.status,
      headers: sanitizeResponseHeaders(upstreamResponse.headers)
    });
  }

  const rawText = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return new Response(rawText, {
      status: upstreamResponse.status,
      headers: sanitizeResponseHeaders(upstreamResponse.headers)
    });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return openaiError(c, 502, "Upstream returned invalid JSON.", "upstream_invalid_response");
  }

  const usage = extractUsageCounters(parsed, usageEstimate);
  const charged = await chargeUsage(c.env, auth.user.id, billingModelSpec, usage, requestId);
  if (!charged.ok) {
    return insufficientQuotaSettlementResponse(c);
  }

  const upstreamCostUsd = calculateUpstreamCostUsd(usage, resolvedModelSpec);
  await appendProfitLedger(c.env.NEXTCLAW_PLATFORM_DB, {
    requestId,
    userId: auth.user.id,
    publicModelId: resolvedModelSpec.id,
    providerAccountId: resolvedModelSpec.providerAccountId,
    upstreamModel: resolvedModelSpec.upstreamModel,
    chargeUsd: charged.split.totalCostUsd,
    upstreamCostUsd,
    grossMarginUsd: roundUsd(charged.split.totalCostUsd - upstreamCostUsd)
  });

  parsed.model = requestedModel;
  return c.json(parsed);
}

function calculateUsageUsd(usage: { promptTokens: number; completionTokens: number }, inputUsdPer1M: number, outputUsdPer1M: number): number {
  return (usage.promptTokens / 1_000_000) * inputUsdPer1M +
    (usage.completionTokens / 1_000_000) * outputUsdPer1M;
}

function toStaticRuntimeModelSpec(model: SupportedModelSpec, env: Env): RuntimeModelSpec {
  return {
    id: model.id,
    displayName: model.displayName,
    upstreamModel: model.upstreamModel,
    apiBase: getDashscopeApiBase(env),
    accessToken: env.DASHSCOPE_API_KEY?.trim() ?? "",
    providerAccountId: null,
    sellInputUsdPer1M: model.inputUsdPer1M,
    sellOutputUsdPer1M: model.outputUsdPer1M,
    upstreamInputUsdPer1M: model.inputUsdPer1M,
    upstreamOutputUsdPer1M: model.outputUsdPer1M
  };
}

async function resolveRuntimeModelSpecs(env: Env): Promise<RuntimeModelSpec[]> {
  const dynamic = await listRuntimeModelSpecs(env.NEXTCLAW_PLATFORM_DB);
  if (dynamic.length > 0) {
    return dynamic;
  }
  return SUPPORTED_MODELS.map((model) => toStaticRuntimeModelSpec(model, env));
}

function toBillingModelSpec(spec: RuntimeModelSpec): SupportedModelSpec {
  return {
    id: spec.id,
    upstreamModel: spec.upstreamModel,
    displayName: spec.displayName,
    inputUsdPer1M: spec.sellInputUsdPer1M,
    outputUsdPer1M: spec.sellOutputUsdPer1M
  };
}

function calculateUpstreamCostUsd(
  usage: { promptTokens: number; completionTokens: number },
  model: RuntimeModelSpec
): number {
  return roundUsd(calculateUsageUsd(usage, model.upstreamInputUsdPer1M, model.upstreamOutputUsdPer1M));
}

function insufficientQuotaPrecheckResponse(
  c: Context<{ Bindings: Env }>,
  snapshot: BillingSnapshot
): Response {
  return c.json(
    {
      error: {
        message: "Quota exceeded. Free quota and paid balance are both insufficient.",
        type: "insufficient_quota",
        param: null,
        code: "insufficient_quota"
      },
      usage: {
        freeQuotaUsdLimit: roundUsd(snapshot.user.free_limit_usd),
        freeQuotaUsdUsed: roundUsd(snapshot.user.free_used_usd),
        freeQuotaUsdRemaining: roundUsd(Math.max(0, snapshot.user.free_limit_usd - snapshot.user.free_used_usd)),
        paidBalanceUsd: roundUsd(snapshot.user.paid_balance_usd),
        globalFreeUsdRemaining: roundUsd(Math.max(0, snapshot.globalFreeLimitUsd - snapshot.globalFreeUsedUsd))
      }
    },
    429
  );
}

function insufficientQuotaSettlementResponse(c: Context<{ Bindings: Env }>): Response {
  return c.json(
    {
      error: {
        message: "Quota exceeded before final settlement.",
        type: "insufficient_quota",
        param: null,
        code: "insufficient_quota"
      }
    },
    429
  );
}
