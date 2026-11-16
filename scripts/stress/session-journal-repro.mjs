import { mkdtemp, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const bundleRoot = process.argv[2];
if (!bundleRoot) throw new Error('Usage: node session-journal-repro.mjs <released-bundle-root>');
const manifest = JSON.parse(await readFile(join(bundleRoot, 'manifest.json'), 'utf8'));
if (manifest.runtimeVersion !== '0.59.1' || manifest.platform !== process.platform) {
  throw new Error('This probe requires the released 0.59.1 bundle for the actual host platform.');
}
const root = await mkdtemp(join(tmpdir(), 'issue73-v591-native-'));
process.env.NEXTCLAW_HOME = join(root, 'home');
const chunk = join(bundleRoot, 'runtime/dist/cli/app/dist-BSD8HAiL.mjs');
const code = await readFile(chunk, 'utf8');
const sourceHash = createHash('sha256').update(code).digest('hex');
if (sourceHash !== 'c29d4429a41a103969f57499f06dea372750d0736be79ed9c397b5fde82f7e7d') {
  throw new Error('Unexpected historical chunk hash; preserve it for investigation instead of patching it.');
}
const probeChunk = join(bundleRoot, 'runtime/dist/cli/app/issue73-probe-exports.mjs');
await writeFile(probeChunk, [code, 'export { NcpAgentSessionJournalStore, SessionManager, SessionRun, AgentRunContextCompactionManager, EventBus, eventKeys$2 as ReproEventKeys, NcpEventType$1 as ReproEventType };', ''].join(String.fromCharCode(10)));
const { NcpAgentSessionJournalStore, SessionManager, SessionRun, AgentRunContextCompactionManager, EventBus, ReproEventKeys: eventKeys, ReproEventType: E } = await import(pathToFileURL(probeChunk).href);
const toolArgs = process.env.REPRO_TOOL_ARGS === '1';
const store = new NcpAgentSessionJournalStore(join(root, 'journal'));
const bus = new EventBus();
const manager = new SessionManager({ eventBus: bus, journalStore: store,
  resolveProjectContext: () => ({ workingDir: root }),
  agentContextWindowManager: { previewSession: async () => null, forgetSession: () => {} },
  agentManager: { resolveAgentProfile: () => ({ workspace: root }) },
  projectManager: { normalizeSessionProjectContext: async () => ({}) },
  sessionSearch: { handleSessionUpdated: async () => {} } });
const failures = [];
const observe = (original, phase) => async (...args) => {
    try { return await original(...args); }
    catch (error) {
      if (failures.length < 8) failures.push({ phase, name: error.name, message: error.message, code: error.code, syscall: error.syscall, path: error.path, stack: error.stack });
      throw error;
    }
};
store.appendJournalEntry = observe(store.appendJournalEntry, 'canonical.append');
store.messageProjectionStore.synchronizeJournalTail = observe(store.messageProjectionStore.synchronizeJournalTail, 'projection.sync');
store.summaryIndexStore.upsertForEvent = observe(store.summaryIndexStore.upsertForEvent, 'catalog.upsert');
store.metadataStore.write = observe(store.metadataStore.write, 'metadata.write');
await manager.start();
function buildResponseEvents(sessionId, round) {
  const id = `stream-${round}`;
  const message = { id, sessionId, role: 'assistant', status: 'streaming', timestamp: new Date().toISOString(), parts: [] };
  const stream = [{ type: E.MessageSent, payload: { sessionId, message } }, { type: E.MessageTextStart, payload: { sessionId, messageId: id } }];
  const text = '中文🙂 " \\ \n {"truncated": '.repeat(80);
  for (const delta of Array.from(text)) stream.push({ type: E.MessageTextDelta, payload: { sessionId, messageId: id, delta } });
  stream.push({ type: E.MessageTextEnd, payload: { sessionId, messageId: id } });
  if (toolArgs) {
    const toolCallId = `tool-${round}`;
    stream.push({ type: E.MessageToolCallStart, payload: { sessionId, messageId: id, toolCallId, toolName: 'synthetic-read-only' } });
    for (const delta of ['{"query":"', '\\\\"quoted\\\\",', '"truncated":[1,2']) {
      stream.push({ type: E.MessageToolCallArgsDelta, payload: { sessionId, toolCallId, delta } });
    }
    stream.push({ type: E.MessageToolCallEnd, payload: { sessionId, toolCallId } });
  }
  stream.push({ type: E.MessageCompleted, payload: { sessionId, message: { ...message, status: 'final', parts: [{ type: 'text', text }] } } });
  return { id, stream, text };
}
const actors = [];
const expected = new Map();
let generated = 0;
const started = Date.now();
try {
  for (const sessionId of ['large-a', 'large-b']) {
    const now = '2026-11-13T18:00:00.000Z';
    const history = Array.from({ length: 1106 }, (_, index) => ({ id: `history-${index}`, sessionId,
      role: index % 2 ? 'assistant' : 'user', status: 'final', timestamp: new Date(Date.parse(now) + index * 1000).toISOString(),
      parts: [{ type: 'text', text: 'x'.repeat(18_000 + (index === 0 ? 232_496 : 0)) + '\n"中文🙂" \\ {"unfinished": ' }] }));
    await store.importSessionSnapshot({ sessionId, messages: history, metadata: {}, createdAt: now, updatedAt: now });
    for (let index = 0; index < 2133; index++) await store.appendSessionEvent({ sessionId,
      event: { type: E.RunMetadata, payload: { sessionId, metadata: { kind: 'repro_history_marker', index } } } });
    const seed = await stat(join(root, 'journal', `${sessionId}.jsonl`));
    console.log(JSON.stringify({ phase: 'seeded', sessionId, bytes: seed.size, records: 3239, messages: 1106 }));
    actors.push(new SessionRun({ sessionId, messages: history }));
  }
  const summary = ['# Compressed Working Context', '## Active Request\n\nFinish the synthetic read-only report.', '## Current Work State\n\nSynthetic history is retained.', '## Safety and User Constraints\n\nPreserve evidence and never repeat completed side effects.', '## Continuation Contract\n\nContinue the read-only report.\n<!-- nextclaw-essential-context-complete -->'].join('\n\n');
  const provider = { chat: async () => ({ content: summary, finishReason: 'stop', usage: {} }) };
  const compaction = new AgentRunContextCompactionManager({ resolveAgentProfileForRun: () => ({ contextTokens: 240000, reservedContextTokens: 10000 }) }, provider, null);
  for (let round = 0; round < 3; round++) {
    const outcomes = await Promise.allSettled(actors.map(async actor => {
      const sessionId = actor.sessionId;
      const events = await compaction.runManual({ sessionId, agentId: 'main', model: 'synthetic', contextBlocks: [], messages: actor.getSnapshot().messages, metadata: {} });
      for (const event of events) { await actor.applyEvents([event]); bus.emit(eventKeys.ncpEvent, event, { source: 'original-runtime-repro', emittedAt: new Date().toISOString() }); }
      await manager.flushSessionEvents();
      const marker = events.find(e => e.type === E.MessageSent && e.payload.message.metadata?.checkpoint?.status === 'compressed');
      if (!marker) throw new Error('Compaction did not produce a compressed checkpoint');
      const { id, stream, text } = buildResponseEvents(sessionId, round);
      for (const event of stream) {
        if (event.type === E.MessageCompleted) event.payload.message = { ...actor.getSnapshot().messages.find(m => m.id === id), status: 'final' };
        await actor.applyEvents([event]); bus.emit(eventKeys.ncpEvent, event, { source: 'original-runtime-repro', emittedAt: new Date().toISOString() }); generated++; }
      await manager.flushSessionEvents();
      const final = actor.getSnapshot().messages.find(m => m.id === id);
      if (!final?.parts.some(part => part.type === 'text' && part.text === text)) throw new Error('Fixture did not produce the expected response text');
      expected.set(`${sessionId}/${id}`, createHash('sha256').update(JSON.stringify(final.parts)).digest('hex'));
      console.log(JSON.stringify({ phase: 'round-completed', round, sessionId, generated, failures: failures.length }));
    }));
    const rejected = outcomes.find(outcome => outcome.status === 'rejected');
    if (rejected) throw rejected.reason;
  }
} catch (error) {
  if (!failures.length) failures.push({ phase: 'driver', name: error.name, message: error.message, stack: error.stack });
} finally { manager.dispose(); actors.forEach(a => a.dispose()); store.close(); }
const cold = new NcpAgentSessionJournalStore(join(root, 'journal'));
let coldResult;
try { coldResult = await Promise.all(['large-a', 'large-b'].map(async sessionId => {
  const record = await cold.getSession(sessionId);
  for (let round = 0; round < 3; round++) {
    const id = `stream-${round}`;
    const saved = record?.messages.find(message => message.id === id);
    if (expected.has(`${sessionId}/${id}`) && (!saved || createHash('sha256').update(JSON.stringify(saved.parts)).digest('hex') !== expected.get(`${sessionId}/${id}`))) {
      throw new Error(`Cold replay differs from the completed live response: ${sessionId}/${id}`);
    }
  }
  if (record?.messages[0]?.id !== 'history-0' || !record.messages.some(message => message.id === 'history-1105')) throw new Error('Cold replay lost original history');
  return { sessionId, messages: record?.messages.length, final: record?.messages.filter(m => m.id.startsWith('stream-')).map(m => ({ id: m.id, hash: createHash('sha256').update(JSON.stringify(m.parts)).digest('hex') })) };
})); } catch (error) { failures.push({ phase: 'cold-read', message: error.message, stack: error.stack }); }
finally { cold.close(); }
const result = { root, platform: process.platform, node: process.version, kernel: '0.19.3', runtime: '0.59.1', sourceHash, toolArgs, injectedFailures: false, generated, failures, coldResult, durationMs: Date.now() - started };
await writeFile(join(root, 'result.json'), JSON.stringify(result, null, 2));
if (process.env.REPRO_RESULT_PATH) await writeFile(process.env.REPRO_RESULT_PATH, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (failures.length) process.exitCode = 1;
