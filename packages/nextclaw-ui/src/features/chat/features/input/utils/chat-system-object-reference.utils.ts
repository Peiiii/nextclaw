import {
  createChatComposerTokenNode,
  normalizeChatComposerNodes,
  type ChatComposerNode,
} from '@nextclaw/agent-chat-ui';
import {
  CHAT_SYSTEM_OBJECT_TOKEN_KIND,
  readSystemObjectResolvedReference,
  type SystemObjectResolvedReference,
} from '@nextclaw/shared';

export { readSystemObjectResolvedReference } from '@nextclaw/shared';

export function createSystemObjectReferenceTokenNode(
  reference: SystemObjectResolvedReference,
): ChatComposerNode {
  return createChatComposerTokenNode({
    tokenKind: CHAT_SYSTEM_OBJECT_TOKEN_KIND,
    tokenKey: reference.uri,
    label: reference.label,
    data: { reference },
  });
}

export function appendSystemObjectReferenceToken(
  nodes: readonly ChatComposerNode[],
  reference: SystemObjectResolvedReference,
): ChatComposerNode[] {
  const exists = nodes.some((node) =>
    node.type === 'token' &&
    node.tokenKind === CHAT_SYSTEM_OBJECT_TOKEN_KIND &&
    node.tokenKey === reference.uri &&
    readSystemObjectResolvedReference(node.data?.reference)?.version === reference.version
  );
  return exists
    ? normalizeChatComposerNodes([...nodes])
    : normalizeChatComposerNodes([...nodes, createSystemObjectReferenceTokenNode(reference)]);
}

export function readSystemObjectReferenceFromToken(
  node: ChatComposerNode,
): SystemObjectResolvedReference | null {
  return node.type === 'token' && node.tokenKind === CHAT_SYSTEM_OBJECT_TOKEN_KIND
    ? readSystemObjectResolvedReference(node.data?.reference)
    : null;
}
