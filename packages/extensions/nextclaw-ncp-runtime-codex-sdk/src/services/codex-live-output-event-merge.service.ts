import type { Thread } from "@openai/codex-sdk";
import { type NcpEndpointEvent, NcpEventType } from "@nextclaw/ncp";
import type {
  ItemTextSnapshot,
  ToolSnapshot,
} from "@/utils/codex-sdk-ncp-event-mapper.utils.js";
import type {
  CodexLiveOutputChannel,
  CodexLiveOutputStream,
} from "./codex-live-output-stream.service.js";

type StreamedTurn = Awaited<ReturnType<Thread["runStreamed"]>>;
type ThreadEvent = StreamedTurn["events"] extends AsyncGenerator<infer T> ? T : never;

export type CodexThreadEventHandlerParams = {
  sessionId: string;
  messageId: string;
  runId: string;
  event: ThreadEvent;
  signal?: AbortSignal;
  itemTextById: Map<string, ItemTextSnapshot>;
  suppressLiveChannels?: Set<CodexLiveOutputChannel>;
  toolStateById: Map<string, ToolSnapshot>;
};

export type CodexLiveOutputEventMergeParams = {
  sessionId: string;
  messageId: string;
  runId: string;
  streamed: StreamedTurn;
  signal?: AbortSignal;
  itemTextById: Map<string, ItemTextSnapshot>;
  liveOutputStream: CodexLiveOutputStream;
  toolStateById: Map<string, ToolSnapshot>;
  emitEvent: (event: NcpEndpointEvent) => AsyncGenerator<NcpEndpointEvent>;
  emitRunCompleted: (
    sessionId: string,
    messageId: string,
    runId: string,
  ) => AsyncGenerator<NcpEndpointEvent>;
  handleThreadEvent: (
    params: CodexThreadEventHandlerParams,
  ) => AsyncGenerator<NcpEndpointEvent, boolean>;
};

export class CodexLiveOutputEventMergeService {
  stream = async function* (
    this: CodexLiveOutputEventMergeService,
    params: CodexLiveOutputEventMergeParams,
  ): AsyncGenerator<NcpEndpointEvent> {
    const {
      emitEvent,
      emitRunCompleted,
      handleThreadEvent,
      itemTextById,
      liveOutputStream,
      messageId,
      runId,
      sessionId,
      signal,
      streamed,
      toolStateById,
    } = params;
    const liveChannels = new Set<CodexLiveOutputChannel>();
    const codexIterator = streamed.events[Symbol.asyncIterator]();
    const liveIterator = this.streamLiveOutputEvents({
      emitEvent,
      liveChannels,
      liveOutputStream,
      messageId,
      sessionId,
      signal,
    })[Symbol.asyncIterator]();
    let finished = false;
    let codexDone = false;
    let liveDone = false;
    let codexNext = codexIterator.next();
    let liveNext = liveIterator.next();

    while (!codexDone || !liveDone) {
      const pending = [
        ...(!codexDone
          ? [codexNext.then((next) => ({ source: "codex" as const, next }))]
          : []),
        ...(!liveDone
          ? [liveNext.then((next) => ({ source: "live" as const, next }))]
          : []),
      ];
      const result = await Promise.race(pending);

      if (result.source === "live") {
        if (result.next.done) {
          liveDone = true;
        } else {
          yield result.next.value;
          liveNext = liveIterator.next();
        }
        continue;
      }

      if (result.next.done) {
        codexDone = true;
        continue;
      }

      const shouldFinish = yield* handleThreadEvent({
        event: result.next.value,
        itemTextById,
        messageId,
        runId,
        sessionId,
        signal,
        suppressLiveChannels: liveChannels,
        toolStateById,
      });
      if (shouldFinish) {
        finished = true;
        break;
      }
      codexNext = codexIterator.next();
    }

    await liveIterator.return?.(undefined);
    if (!finished) {
      yield* emitRunCompleted(sessionId, messageId, runId);
    }
  };

  private streamLiveOutputEvents = async function* (
    this: CodexLiveOutputEventMergeService,
    params: {
      sessionId: string;
      messageId: string;
      signal?: AbortSignal;
      liveChannels: Set<CodexLiveOutputChannel>;
      liveOutputStream: CodexLiveOutputStream;
      emitEvent: (event: NcpEndpointEvent) => AsyncGenerator<NcpEndpointEvent>;
    },
  ): AsyncGenerator<NcpEndpointEvent> {
    const {
      emitEvent,
      liveChannels,
      liveOutputStream,
      messageId,
      sessionId,
      signal,
    } = params;
    const startedChannels = new Set<CodexLiveOutputChannel>();
    for await (const event of liveOutputStream.events(signal)) {
      if (event.type === "delta") {
        liveChannels.add(event.channel);
        if (!startedChannels.has(event.channel)) {
          startedChannels.add(event.channel);
          yield* emitEvent({
            type: event.channel === "reasoning"
              ? NcpEventType.MessageReasoningStart
              : NcpEventType.MessageTextStart,
            payload: { sessionId, messageId },
          });
        }
        yield* emitEvent({
          type: event.channel === "reasoning"
            ? NcpEventType.MessageReasoningDelta
            : NcpEventType.MessageTextDelta,
          payload: { sessionId, messageId, delta: event.delta },
        });
        continue;
      }

      if (event.type === "end") {
        if (startedChannels.has(event.channel)) {
          yield* emitEvent({
            type: event.channel === "reasoning"
              ? NcpEventType.MessageReasoningEnd
              : NcpEventType.MessageTextEnd,
            payload: { sessionId, messageId },
          });
        }
        continue;
      }

      return;
    }
  };
}
