import {
  createChatComposerNodesFromText,
  createChatComposerTokenNode,
  createEmptyChatComposerNodes,
  extractChatComposerTokenKeys,
  normalizeChatComposerNodes,
  removeChatComposerTokenNodes,
  serializeChatComposerPlainText
} from '@nextclaw/agent-chat-ui';
import type { ChatComposerNode } from '@nextclaw/agent-chat-ui';
import type { NcpMessagePart } from '@nextclaw/ncp';
import type { NcpDraftAttachment } from '@nextclaw/ncp-react';

const CHAT_SKILL_TOKEN_PREFIX = '$';

function appendTextPart(parts: NcpMessagePart[], text: string): NcpMessagePart[] {
  if (text.length === 0) {
    return parts;
  }
  const previous = parts[parts.length - 1];
  if (previous?.type === 'text') {
    return [...parts.slice(0, -1), { ...previous, text: previous.text + text }];
  }
  return [
    ...parts,
    {
      type: 'text',
      text
    }
  ];
}

export function createInitialChatComposerNodes(): ChatComposerNode[] {
  return createEmptyChatComposerNodes();
}

export function createChatComposerNodesFromDraft(text: string): ChatComposerNode[] {
  return createChatComposerNodesFromText(text);
}

export function deriveChatComposerDraft(nodes: ChatComposerNode[]): string {
  return serializeChatComposerPlainText(nodes);
}

export function deriveSelectedSkillsFromComposer(nodes: ChatComposerNode[]): string[] {
  return extractChatComposerTokenKeys(nodes, 'skill');
}

export function deriveSelectedAttachmentIdsFromComposer(nodes: ChatComposerNode[]): string[] {
  return extractChatComposerTokenKeys(nodes, 'file');
}

export function syncComposerSkills(
  nodes: ChatComposerNode[],
  nextSkills: string[],
  skillRecords: Array<{ ref: string; name: string }>
): ChatComposerNode[] {
  const nextSkillSet = new Set(nextSkills);
  const prunedNodes = removeChatComposerTokenNodes(
    nodes,
    (node) => node.tokenKind === 'skill' && !nextSkillSet.has(node.tokenKey)
  );
  const existingSkills = extractChatComposerTokenKeys(prunedNodes, 'skill');
  const recordMap = new Map(skillRecords.map((record) => [record.ref, record]));
  const appendedNodes = nextSkills
    .filter((skill) => !existingSkills.includes(skill))
    .map((skill) =>
      createChatComposerTokenNode({
        tokenKind: 'skill',
        tokenKey: skill,
        label: recordMap.get(skill)?.name || skill
      })
    );

  return appendedNodes.length === 0
    ? prunedNodes
    : normalizeChatComposerNodes([...prunedNodes, ...appendedNodes]);
}

export function syncComposerAttachments(
  nodes: ChatComposerNode[],
  attachments: readonly NcpDraftAttachment[]
): ChatComposerNode[] {
  const nextAttachmentIds = new Set(attachments.map((attachment) => attachment.id));
  return removeChatComposerTokenNodes(
    nodes,
    (node) => node.tokenKind === 'file' && !nextAttachmentIds.has(node.tokenKey)
  );
}

export function pruneComposerAttachments(
  nodes: ChatComposerNode[],
  attachments: readonly NcpDraftAttachment[]
): NcpDraftAttachment[] {
  const selectedIds = new Set(deriveSelectedAttachmentIdsFromComposer(nodes));
  return attachments.filter((attachment) => selectedIds.has(attachment.id));
}

export function deriveNcpMessagePartsFromComposer(
  nodes: ChatComposerNode[],
  attachments: readonly NcpDraftAttachment[]
): NcpMessagePart[] {
  const attachmentById = new Map(attachments.map((attachment) => [attachment.id, attachment]));
  let parts: NcpMessagePart[] = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      parts = appendTextPart(parts, node.text);
      continue;
    }

    if (node.tokenKind === 'skill') {
      parts = appendTextPart(parts, `${CHAT_SKILL_TOKEN_PREFIX}${node.tokenKey}`);
      continue;
    }

    if (node.tokenKind !== 'file') {
      continue;
    }

    const attachment = attachmentById.get(node.tokenKey);
    if (!attachment) {
      continue;
    }

    parts.push({
      type: 'file',
      name: attachment.name,
      mimeType: attachment.mimeType,
      ...(attachment.assetUri ? { assetUri: attachment.assetUri } : {}),
      ...(attachment.url ? { url: attachment.url } : {}),
      ...(attachment.contentBase64 ? { contentBase64: attachment.contentBase64 } : {}),
      sizeBytes: attachment.sizeBytes
    });
  }

  return parts;
}
