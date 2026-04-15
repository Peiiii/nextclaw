import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createDeferred,
  delay,
  isAbortError,
  isTerminalEvent,
  parseSseBlock,
  summarizeEvents,
} from "../chat-capability-smoke.utils.mjs";
import {
  buildStablePrompt,
  createId,
  DEFAULT_EXPECTED_REPLY,
  SESSION_TYPE_READY_POLL_MS,
  toPercent,
} from "./prompt-cache-smoke.shared.mjs";

class UsageLogCursor {
  constructor(options) {
    this.options = options;
    this.usageLogPath = resolve(this.options.home, "logs", "llm-usage.jsonl");
    this.lineCursor = this.readLines().length;
  }

  readLines = () => {
    if (!existsSync(this.usageLogPath)) {
      return [];
    }
    return readFileSync(this.usageLogPath, "utf8")
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  };

  readNewRecord = ({ model, runStartedAt, runFinishedAt }) => {
    const lines = this.readLines();
    const freshLines = lines.slice(this.lineCursor);
    this.lineCursor = lines.length;
    const startedAtMs = runStartedAt.getTime() - 5_000;
    const finishedAtMs = runFinishedAt.getTime() + Math.max(this.options.usageSettleMs, 5_000);
    const matches = freshLines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((record) => {
        if (!record || typeof record !== "object") {
          return false;
        }
        if (record.source !== this.options.usageSource.trim() || record.model !== model.trim()) {
          return false;
        }
        const observedAtMs =
          typeof record.observedAt === "string" ? Date.parse(record.observedAt) : Number.NaN;
        return Number.isFinite(observedAtMs) && observedAtMs >= startedAtMs && observedAtMs <= finishedAtMs;
      });
    return matches.at(-1) ?? null;
  };
}

export class NcpChatPromptCacheSmokeRunner {
  constructor(options) {
    this.options = options;
    this.prompt =
      `${buildStablePrompt(options)}\n\n` +
      `Reply exactly ${DEFAULT_EXPECTED_REPLY}. Do not add punctuation, markdown, explanation, or extra words.`;
    this.sessionId = createId(`prompt-cache-${this.options.sessionType}`);
    this.usageCursor = new UsageLogCursor(options);
  }

  run = async () => {
    const runs = [];
    await this.waitForSessionTypeReady();
    for (let index = 0; index < this.options.runs; index += 1) {
      const runStartedAt = new Date();
      const summary = await this.runOnce(index + 1);
      await delay(this.options.usageSettleMs, new AbortController().signal);
      const runFinishedAt = new Date();
      const usageRecord = this.usageCursor.readNewRecord({
        model: this.options.model,
        runStartedAt,
        runFinishedAt,
      });
      runs.push(this.buildRunResult(index + 1, summary, usageRecord));
    }
    return this.buildResult(runs);
  };

  waitForSessionTypeReady = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new Error(`session type readiness timed out after ${this.options.timeoutMs}ms`));
    }, this.options.timeoutMs);
    try {
      while (!controller.signal.aborted) {
        const response = await fetch(`${this.options.baseUrl}/api/ncp/session-types`, {
          method: "GET",
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`session-types failed with HTTP ${response.status}: ${await response.text()}`);
        }
        const payload = await response.json();
        const option = (Array.isArray(payload?.data?.options) ? payload.data.options : []).find(
          (entry) => entry?.value === this.options.sessionType.trim(),
        );
        if (option?.ready === true) {
          return;
        }
        if (option && option.ready === false) {
          const reason = option.reasonMessage || option.reason || "unknown reason";
          throw new Error(`session type ${this.options.sessionType} is not ready: ${reason}`);
        }
        await delay(SESSION_TYPE_READY_POLL_MS, controller.signal);
      }
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(`session type readiness timed out after ${this.options.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  buildEnvelope = () => {
    return {
      sessionId: this.sessionId,
      correlationId: createId("corr"),
      metadata: {
        session_type: this.options.sessionType.trim(),
        sessionType: this.options.sessionType.trim(),
        preferred_model: this.options.model.trim(),
        model: this.options.model.trim(),
      },
      message: {
        id: createId("user"),
        sessionId: this.sessionId,
        role: "user",
        status: "final",
        timestamp: new Date().toISOString(),
        parts: [{ type: "text", text: this.prompt }],
      },
    };
  };

  runOnce = async () => {
    const envelope = this.buildEnvelope();
    const streamController = new AbortController();
    const sendController = new AbortController();
    const events = [];
    let stream = null;
    const timer = setTimeout(() => {
      streamController.abort(new Error(`ncp smoke timed out after ${this.options.timeoutMs}ms`));
      sendController.abort(new Error(`ncp smoke timed out after ${this.options.timeoutMs}ms`));
    }, this.options.timeoutMs);

    try {
      stream = this.startStream(streamController.signal, (event) => {
        events.push(event);
        if (isTerminalEvent(event)) {
          streamController.abort();
        }
      });
      await stream.ready;
      const response = await fetch(`${this.options.baseUrl}/api/ncp/agent/send`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(envelope),
        signal: sendController.signal,
      });
      if (!response.ok) {
        throw new Error(`send failed with HTTP ${response.status}: ${await response.text()}`);
      }
      await stream.done;
      return summarizeEvents(events);
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(`ncp smoke timed out after ${this.options.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
      if (!streamController.signal.aborted) {
        streamController.abort();
      }
      if (!sendController.signal.aborted) {
        sendController.abort();
      }
      await stream?.done.catch(() => undefined);
    }
  };

  startStream = (signal, onEvent) => {
    const ready = createDeferred();
    const done = (async () => {
      try {
        const response = await fetch(
          `${this.options.baseUrl}/api/ncp/agent/stream?sessionId=${encodeURIComponent(this.sessionId)}`,
          {
            method: "GET",
            headers: {
              accept: "text/event-stream",
              "cache-control": "no-cache",
            },
            signal,
          },
        );
        if (!response.ok || !response.body) {
          const text = await response.text().catch(() => "");
          throw new Error(`stream failed with HTTP ${response.status}: ${text}`);
        }
        ready.resolve();
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (!signal.aborted) {
            const { value, done: readerDone } = await reader.read();
            if (readerDone) {
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            buffer = this.consumeSseBuffer(buffer, onEvent);
          }
          buffer += decoder.decode();
          this.consumeSseBuffer(`${buffer}\n\n`, onEvent);
        } finally {
          reader.releaseLock();
        }
      } catch (error) {
        if (signal.aborted && isAbortError(error)) {
          ready.resolve();
          return;
        }
        ready.reject(error);
        throw error;
      }
    })();
    return { ready: ready.promise, done };
  };

  consumeSseBuffer = (buffer, onEvent) => {
    let nextBuffer = buffer;
    let boundary = nextBuffer.search(/\r?\n\r?\n/);
    while (boundary >= 0) {
      const block = nextBuffer.slice(0, boundary);
      const separator = nextBuffer.slice(boundary).match(/^\r?\n\r?\n/)?.[0] ?? "\n\n";
      nextBuffer = nextBuffer.slice(boundary + separator.length);
      const parsed = parseSseBlock(block);
      if (parsed) {
        onEvent(parsed);
      }
      boundary = nextBuffer.search(/\r?\n\r?\n/);
    }
    return nextBuffer;
  };

  buildRunResult = (runNumber, summary, usageRecord) => {
    const usage = usageRecord?.usage ?? {};
    const cacheMetricKeys = Object.keys(usage).filter((key) => key.endsWith("cached_tokens"));
    const cachedTokens = cacheMetricKeys.reduce((max, key) => Math.max(max, usage[key] ?? 0), 0);
    return {
      run: runNumber,
      promptTokens: usage.prompt_tokens ?? usage.input_tokens ?? usageRecord?.summary?.promptTokens ?? 0,
      completionTokens:
        usage.completion_tokens ?? usage.output_tokens ?? usageRecord?.summary?.completionTokens ?? 0,
      totalTokens: usage.total_tokens ?? usageRecord?.summary?.totalTokens ?? 0,
      cachedTokens,
      cacheMetricKeys,
      finishReason: summary.terminalEvent || "run.finished",
      content: summary.assistantText ?? "",
      usage,
      usageObservedAt: usageRecord?.observedAt ?? null,
      usageFound: Boolean(usageRecord),
      streamOk: Boolean(summary.ok),
      errorMessage: summary.errorMessage ?? "",
    };
  };

  buildResult = (runs) => {
    const warmup = runs[0];
    const laterRuns = runs.slice(1);
    const laterPromptTokens = laterRuns.reduce((sum, run) => sum + run.promptTokens, 0);
    const laterCachedTokens = laterRuns.reduce((sum, run) => sum + run.cachedTokens, 0);
    const laterCacheHits = laterRuns.filter((run) => run.cachedTokens > 0).length;
    const laterCacheRate = laterPromptTokens > 0 ? laterCachedTokens / laterPromptTokens : 0;
    const hasCacheTelemetry = laterRuns.some((run) => run.cacheMetricKeys.length > 0);
    const missingUsageRuns = runs.filter((run) => !run.usageFound).length;
    const streamFailureRuns = runs.filter((run) => !run.streamOk).length;
    const exactReplyCount = runs.filter((run) => run.content.trim() === DEFAULT_EXPECTED_REPLY).length;

    let status = "PASS";
    let reason = `later repeated runs reached ${toPercent(laterCacheRate)} cached/prompt token rate`;
    if (streamFailureRuns > 0) {
      status = "FAIL";
      reason = `${streamFailureRuns} run(s) failed to complete cleanly over NCP`;
    } else if (exactReplyCount !== runs.length) {
      status = "FAIL";
      reason = `model reply drifted from expected exact reply in ${runs.length - exactReplyCount} run(s)`;
    } else if (missingUsageRuns > 0) {
      status = "INCONCLUSIVE";
      reason = `${missingUsageRuns} run(s) finished but no matching usage record was found in ${this.usageCursor.usageLogPath}`;
    } else if (laterPromptTokens === 0) {
      status = "INCONCLUSIVE";
      reason = "later runs did not report prompt tokens, so cache behavior cannot be judged";
    } else if (!hasCacheTelemetry) {
      status = "INCONCLUSIVE";
      reason = "ncp runs finished, but provider did not expose any cached token telemetry in later runs";
    } else if (laterCacheHits === 0) {
      status = "FAIL";
      reason = "later runs exposed telemetry but no cached tokens were reported";
    } else if (laterCacheRate < this.options.minCacheRate) {
      status = "FAIL";
      reason = `later cached/prompt token rate ${toPercent(laterCacheRate)} is below threshold ${toPercent(this.options.minCacheRate)}`;
    }

    return {
      ok: status === "PASS",
      status,
      reason,
      mode: "ncp-chat",
      sessionMode: "sticky",
      model: this.options.model.trim(),
      home: this.options.home,
      baseUrl: this.options.baseUrl,
      sessionType: this.options.sessionType,
      usageSource: this.options.usageSource,
      usageLogPath: this.usageCursor.usageLogPath,
      runsRequested: this.options.runs,
      minCacheRate: this.options.minCacheRate,
      systemPromptChars: this.prompt.length,
      expectedReply: DEFAULT_EXPECTED_REPLY,
      warmup: {
        promptTokens: warmup.promptTokens,
        cachedTokens: warmup.cachedTokens,
        cacheMetricKeys: warmup.cacheMetricKeys,
      },
      laterRuns: {
        count: laterRuns.length,
        cacheHitRuns: laterCacheHits,
        promptTokens: laterPromptTokens,
        cachedTokens: laterCachedTokens,
        cacheRate: laterCacheRate,
      },
      runs,
    };
  };
}
