import type {
  ChatComposerNode,
  ChatComposerSelection,
  ChatComposerTokenKind,
  ChatSkillPickerOption,
} from '../../../view-models/chat-ui.types';
import {
  createChatComposerTextNode,
  createChatComposerTokenNode,
  extractChatComposerTokenKeys,
  getChatComposerNodeLength,
  normalizeChatComposerNodes,
  removeChatComposerTokenNodes,
  replaceChatComposerRange,
  resolveChatComposerSlashTrigger,
} from '../chat-composer.utils';
import type { ChatComposerEditorSnapshot } from './chat-composer-lexical-editor-state';

function getDocumentLength(nodes: ChatComposerNode[]): number {
  return nodes.reduce((sum, node) => sum + getChatComposerNodeLength(node), 0);
}

function insertToken(params: {
  label: string;
  nodes: ChatComposerNode[];
  selection: ChatComposerSelection | null;
  tokenKey: string;
  tokenKind: ChatComposerTokenKind;
  trigger?: { end: number; query: string; start: number } | null;
}): ChatComposerEditorSnapshot {
  const { label, nodes, selection, tokenKey, tokenKind, trigger } = params;
  const documentLength = getDocumentLength(nodes);
  const replaceStart = trigger?.start ?? selection?.start ?? documentLength;
  const replaceEnd = trigger?.end ?? selection?.end ?? replaceStart;

  return {
    nodes: replaceChatComposerRange(
      nodes,
      replaceStart,
      replaceEnd,
      [
        createChatComposerTokenNode({
          label,
          tokenKey,
          tokenKind,
        }),
      ],
    ),
    selection: {
      start: replaceStart + 1,
      end: replaceStart + 1,
    },
  };
}

export function getChatComposerNodesSignature(nodes: ChatComposerNode[]): string {
  return nodes
    .map((node) =>
      node.type === 'text'
        ? `text:${node.id}:${node.text}`
        : `token:${node.id}:${node.tokenKind}:${node.tokenKey}:${node.label}`,
    )
    .join('\u001f');
}

export function replaceChatComposerSelectionWithText(params: {
  nodes: ChatComposerNode[];
  selection: ChatComposerSelection | null;
  text: string;
}): ChatComposerEditorSnapshot {
  const { nodes, selection, text } = params;
  const currentSelection = selection ?? {
    start: getDocumentLength(nodes),
    end: getDocumentLength(nodes),
  };
  const nextOffset = currentSelection.start + text.length;

  return {
    nodes: replaceChatComposerRange(
      nodes,
      currentSelection.start,
      currentSelection.end,
      [createChatComposerTextNode(text)],
    ),
    selection: {
      start: nextOffset,
      end: nextOffset,
    },
  };
}

export function insertFileTokenIntoChatComposer(params: {
  label: string;
  nodes: ChatComposerNode[];
  selection: ChatComposerSelection | null;
  tokenKey: string;
}): ChatComposerEditorSnapshot {
  const { label, nodes, selection, tokenKey } = params;
  return insertToken({
    label,
    nodes,
    selection,
    tokenKey,
    tokenKind: 'file',
  });
}

export function insertSkillTokenIntoChatComposer(params: {
  label: string;
  nodes: ChatComposerNode[];
  selection: ChatComposerSelection | null;
  tokenKey: string;
}): ChatComposerEditorSnapshot {
  const { label, nodes, selection, tokenKey } = params;

  if (extractChatComposerTokenKeys(nodes, 'skill').includes(tokenKey)) {
    return {
      nodes: normalizeChatComposerNodes(nodes),
      selection,
    };
  }

  return insertToken({
    label,
    nodes,
    selection,
    tokenKey,
    tokenKind: 'skill',
    trigger: resolveChatComposerSlashTrigger(nodes, selection),
  });
}

export function syncSelectedSkillsIntoChatComposer(params: {
  nextKeys: string[];
  nodes: ChatComposerNode[];
  options: ChatSkillPickerOption[];
  selection: ChatComposerSelection | null;
}): ChatComposerEditorSnapshot {
  const { nextKeys, nodes, options, selection } = params;
  const selectedSkillKeys = extractChatComposerTokenKeys(nodes, 'skill');
  const optionMap = new Map(options.map((option) => [option.key, option]));
  const addedKey = nextKeys.find((key) => !selectedSkillKeys.includes(key));

  if (addedKey) {
    const option = optionMap.get(addedKey);
    return insertSkillTokenIntoChatComposer({
      label: option?.label ?? addedKey,
      nodes,
      selection,
      tokenKey: addedKey,
    });
  }

  const removedKey = selectedSkillKeys.find((key) => !nextKeys.includes(key));
  if (!removedKey) {
    return {
      nodes: normalizeChatComposerNodes(nodes),
      selection,
    };
  }

  return {
    nodes: removeChatComposerTokenNodes(
      nodes,
      (node) => node.tokenKind === 'skill' && node.tokenKey === removedKey,
    ),
    selection,
  };
}

export function deleteChatComposerContent(params: {
  direction: 'backward' | 'forward';
  nodes: ChatComposerNode[];
  selection: ChatComposerSelection | null;
}): ChatComposerEditorSnapshot {
  const { direction, nodes, selection: currentSelection } = params;
  const documentLength = getDocumentLength(nodes);
  const selection = currentSelection ?? { start: documentLength, end: documentLength };
  let rangeStart = selection.start;
  let rangeEnd = selection.end;

  if (selection.start === selection.end) {
    if (direction === 'backward' && selection.start > 0) {
      rangeStart = selection.start - 1;
    } else if (direction === 'forward' && selection.end < documentLength) {
      rangeEnd = selection.end + 1;
    } else {
      return {
        nodes: normalizeChatComposerNodes(nodes),
        selection,
      };
    }
  }

  return {
    nodes: replaceChatComposerRange(nodes, rangeStart, rangeEnd, []),
    selection: {
      start: rangeStart,
      end: rangeStart,
    },
  };
}
