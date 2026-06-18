import type {
  ChatComposerNode,
  ChatComposerSelection,
  ChatComposerTextNode,
  ChatComposerTokenKind,
  ChatComposerTokenNode,
  ChatInputSurfaceTrigger,
  ChatInputSurfaceTriggerSpec,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

export const CHAT_COMPOSER_TOKEN_PLACEHOLDER = '\uFFFC';
export const CHAT_INPUT_SURFACE_SLASH_TRIGGER_SPEC: ChatInputSurfaceTriggerSpec = {
  key: 'slash',
  marker: '/',
};

function createComposerNodeId(): string {
  return `composer-${Math.random().toString(36).slice(2, 10)}`;
}

export function createChatComposerTextNode(text = ''): ChatComposerTextNode {
  return {
    id: createComposerNodeId(),
    type: 'text',
    text
  };
}

export function createChatComposerTokenNode(params: {
  tokenKind: ChatComposerTokenKind;
  tokenKey: string;
  label: string;
}): ChatComposerTokenNode {
  return {
    id: createComposerNodeId(),
    type: 'token',
    tokenKind: params.tokenKind,
    tokenKey: params.tokenKey,
    label: params.label
  };
}

export function getChatComposerNodeLength(node: ChatComposerNode): number {
  return node.type === 'text' ? node.text.length : 1;
}

export function createEmptyChatComposerNodes(): ChatComposerNode[] {
  return [createChatComposerTextNode('')];
}

export function createChatComposerNodesFromText(text: string): ChatComposerNode[] {
  return [createChatComposerTextNode(text)];
}

export function normalizeChatComposerNodes(nodes: ChatComposerNode[]): ChatComposerNode[] {
  const normalized: ChatComposerNode[] = [];
  for (const node of nodes) {
    if (node.type === 'text') {
      if (node.text.length === 0) {
        continue;
      }
      const previous = normalized[normalized.length - 1];
      if (previous?.type === 'text') {
        normalized[normalized.length - 1] = {
          ...previous,
          text: previous.text + node.text
        };
        continue;
      }
    }
    normalized.push(node);
  }
  if (normalized.length === 0) {
    return createEmptyChatComposerNodes();
  }
  return normalized;
}

export function serializeChatComposerDocument(nodes: ChatComposerNode[]): string {
  return nodes.map((node) => (node.type === 'text' ? node.text : CHAT_COMPOSER_TOKEN_PLACEHOLDER)).join('');
}

export function serializeChatComposerPlainText(nodes: ChatComposerNode[]): string {
  return nodes.filter((node): node is ChatComposerTextNode => node.type === 'text').map((node) => node.text).join('');
}

export function extractChatComposerTokenKeys(
  nodes: ChatComposerNode[],
  tokenKind: ChatComposerTokenKind
): string[] {
  const keys: string[] = [];
  const keySet = new Set<string>();
  for (const node of nodes) {
    if (node.type !== 'token' || node.tokenKind !== tokenKind || keySet.has(node.tokenKey)) {
      continue;
    }
    keySet.add(node.tokenKey);
    keys.push(node.tokenKey);
  }
  return keys;
}

function buildTrimmedTextEdges(
  node: ChatComposerTextNode,
  nodeStart: number,
  rangeStart: number,
  rangeEnd: number
): ChatComposerTextNode[] {
  const prefixLength = Math.max(0, rangeStart - nodeStart);
  const suffixLength = Math.max(0, nodeStart + node.text.length - rangeEnd);
  const edges: ChatComposerTextNode[] = [];

  if (prefixLength > 0) {
    edges.push({
      ...node,
      text: node.text.slice(0, prefixLength)
    });
  }
  if (suffixLength > 0) {
    edges.push({
      ...node,
      text: node.text.slice(node.text.length - suffixLength)
    });
  }

  return edges;
}

function isNodeOutsideComposerRange(
  nodeStart: number,
  nodeEnd: number,
  boundedStart: number,
  boundedEnd: number
): boolean {
  return nodeEnd <= boundedStart || nodeStart >= boundedEnd;
}

function appendReplacementBeforeNode(
  nextNodes: ChatComposerNode[],
  replacement: ChatComposerNode[],
  inserted: boolean,
  nodeStart: number,
  boundedEnd: number
): boolean {
  if (!inserted && nodeStart >= boundedEnd) {
    nextNodes.push(...replacement);
    return true;
  }
  return inserted;
}

function appendTextNodeWithReplacement(
  nextNodes: ChatComposerNode[],
  node: ChatComposerTextNode,
  nodeStart: number,
  boundedStart: number,
  boundedEnd: number,
  replacement: ChatComposerNode[],
  inserted: boolean
): boolean {
  const edges = buildTrimmedTextEdges(node, nodeStart, boundedStart, boundedEnd);
  if (edges[0]) {
    nextNodes.push(edges[0]);
  }
  let didInsert = inserted;
  if (!didInsert) {
    nextNodes.push(...replacement);
    didInsert = true;
  }
  if (edges[1]) {
    nextNodes.push(edges[1]);
  }
  return didInsert;
}

function appendTokenNodeWithReplacement(
  nextNodes: ChatComposerNode[],
  node: ChatComposerNode,
  replacement: ChatComposerNode[],
  inserted: boolean,
  boundedStart: number,
  nodeStart: number
): boolean {
  if (!inserted && boundedStart <= nodeStart) {
    nextNodes.push(...replacement);
    return true;
  }
  nextNodes.push(node);
  return inserted;
}

export function replaceChatComposerRange(
  nodes: ChatComposerNode[],
  start: number,
  end: number,
  replacement: ChatComposerNode[]
): ChatComposerNode[] {
  const boundedStart = Math.max(0, start);
  const boundedEnd = Math.max(boundedStart, end);
  const nextNodes: ChatComposerNode[] = [];
  let cursor = 0;
  let inserted = false;

  for (const node of nodes) {
    const nodeLength = getChatComposerNodeLength(node);
    const nodeStart = cursor;
    const nodeEnd = cursor + nodeLength;
    const isOutsideRange = isNodeOutsideComposerRange(nodeStart, nodeEnd, boundedStart, boundedEnd);

    if (isOutsideRange) {
      inserted = appendReplacementBeforeNode(nextNodes, replacement, inserted, nodeStart, boundedEnd);
      nextNodes.push(node);
      cursor = nodeEnd;
      continue;
    }

    if (node.type === 'text') {
      inserted = appendTextNodeWithReplacement(
        nextNodes,
        node,
        nodeStart,
        boundedStart,
        boundedEnd,
        replacement,
        inserted
      );
    } else {
      inserted = appendTokenNodeWithReplacement(nextNodes, node, replacement, inserted, boundedStart, nodeStart);
    }

    cursor = nodeEnd;
  }

  if (!inserted) {
    nextNodes.push(...replacement);
  }

  return normalizeChatComposerNodes(nextNodes);
}

export function removeChatComposerTokenNodes(
  nodes: ChatComposerNode[],
  predicate: (node: ChatComposerTokenNode) => boolean
): ChatComposerNode[] {
  return normalizeChatComposerNodes(
    nodes.filter((node) => node.type !== 'token' || !predicate(node))
  );
}

function hasTriggerBoundary(prefix: string, markerStart: number): boolean {
  return markerStart === 0 || /\s/.test(prefix[markerStart - 1] ?? '');
}

export function resolveChatComposerInputSurfaceTrigger(
  nodes: ChatComposerNode[],
  selection: ChatComposerSelection | null,
  triggerSpec: ChatInputSurfaceTriggerSpec
): ChatInputSurfaceTrigger | null {
  if (!selection || selection.start !== selection.end) {
    return null;
  }

  const documentText = serializeChatComposerDocument(nodes);
  const caret = selection.end;
  const prefix = documentText.slice(0, caret);
  const markerStart = prefix.lastIndexOf(triggerSpec.marker);
  if (markerStart < 0 || !hasTriggerBoundary(prefix, markerStart)) {
    return null;
  }

  const rawQuery = prefix.slice(markerStart + triggerSpec.marker.length);
  if (/[\s\uFFFC]/.test(rawQuery)) {
    return null;
  }

  return {
    key: triggerSpec.key,
    marker: triggerSpec.marker,
    query: rawQuery.trim().toLowerCase(),
    start: markerStart,
    end: caret,
  };
}

export function resolveChatComposerActiveInputSurfaceTrigger(
  nodes: ChatComposerNode[],
  selection: ChatComposerSelection | null,
  triggerSpecs: readonly ChatInputSurfaceTriggerSpec[] = [CHAT_INPUT_SURFACE_SLASH_TRIGGER_SPEC],
): ChatInputSurfaceTrigger | null {
  let activeTrigger: ChatInputSurfaceTrigger | null = null;
  for (const triggerSpec of triggerSpecs) {
    const trigger = resolveChatComposerInputSurfaceTrigger(nodes, selection, triggerSpec);
    if (!trigger) {
      continue;
    }
    if (!activeTrigger || trigger.start > activeTrigger.start) {
      activeTrigger = trigger;
    }
  }
  return activeTrigger;
}

export function resolveChatComposerSlashTrigger(
  nodes: ChatComposerNode[],
  selection: ChatComposerSelection | null
): { query: string; start: number; end: number } | null {
  const trigger = resolveChatComposerInputSurfaceTrigger(
    nodes,
    selection,
    CHAT_INPUT_SURFACE_SLASH_TRIGGER_SPEC,
  );
  return trigger
    ? {
        query: trigger.query,
        start: trigger.start,
        end: trigger.end,
      }
    : null;
}

export function isChatComposerSelectionInsideRange(
  selection: ChatComposerSelection | null,
  start: number,
  end: number
): boolean {
  if (!selection) {
    return false;
  }
  return selection.start < end && selection.end > start;
}
