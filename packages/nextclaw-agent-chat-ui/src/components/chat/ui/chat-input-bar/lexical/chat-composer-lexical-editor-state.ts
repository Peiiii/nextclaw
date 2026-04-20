import {
  $createLineBreakNode,
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  type EditorState,
  type ElementPoint,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type PointType,
} from 'lexical';
import type { ChatComposerNode, ChatComposerSelection } from '../../../view-models/chat-ui.types';
import { normalizeChatComposerNodes } from '../chat-composer.utils';
import {
  $createChatComposerTokenNode,
  $isChatComposerTokenNode,
  type ChatComposerTokenNode,
} from './chat-composer-token-node';

type LeafDescriptor =
  | {
      index: number;
      key: NodeKey;
      length: number;
      node: LexicalNode;
      start: number;
      type: 'linebreak' | 'token';
    }
  | {
      index: number;
      key: NodeKey;
      length: number;
      node: LexicalNode;
      start: number;
      text: string;
      type: 'text';
    };

type SelectionPointDescriptor = {
  key: NodeKey;
  offset: number;
  type: 'element' | 'text';
};

export type ChatComposerEditorSnapshot = {
  nodes: ChatComposerNode[];
  selection: ChatComposerSelection | null;
};

function getComposerLeafDescriptors(): {
  descriptors: LeafDescriptor[];
  paragraphKey: NodeKey;
  paragraphSize: number;
  totalLength: number;
} {
  const root = $getRoot();
  const paragraph = root.getFirstChild();
  if (!$isElementNode(paragraph)) {
    return {
      descriptors: [],
      paragraphKey: root.getKey(),
      paragraphSize: 0,
      totalLength: 0,
    };
  }

  const children = paragraph.getChildren();
  const descriptors: LeafDescriptor[] = [];
  let cursor = 0;

  for (const [index, child] of children.entries()) {
    if ($isTextNode(child)) {
      const text = child.getTextContent();
      descriptors.push({
        index,
        key: child.getKey(),
        length: text.length,
        node: child,
        start: cursor,
        text,
        type: 'text',
      });
      cursor += text.length;
      continue;
    }

    if ($isChatComposerTokenNode(child)) {
      descriptors.push({
        index,
        key: child.getKey(),
        length: 1,
        node: child,
        start: cursor,
        type: 'token',
      });
      cursor += 1;
      continue;
    }

    descriptors.push({
      index,
      key: child.getKey(),
      length: child.getTextContent().length,
      node: child,
      start: cursor,
      type: 'linebreak',
    });
    cursor += child.getTextContent().length;
  }

  return {
    descriptors,
    paragraphKey: paragraph.getKey(),
    paragraphSize: children.length,
    totalLength: cursor,
  };
}

function buildSelectionPointFromOffset(offset: number): SelectionPointDescriptor {
  const { descriptors, paragraphKey, paragraphSize, totalLength } = getComposerLeafDescriptors();
  const boundedOffset = Math.max(0, Math.min(offset, totalLength));

  if (descriptors.length === 0) {
    return {
      key: paragraphKey,
      offset: 0,
      type: 'element',
    };
  }

  for (const descriptor of descriptors) {
    const end = descriptor.start + descriptor.length;

    if (descriptor.type === 'text' && boundedOffset >= descriptor.start && boundedOffset <= end) {
      return {
        key: descriptor.key,
        offset: boundedOffset - descriptor.start,
        type: 'text',
      };
    }

    if (descriptor.type !== 'text') {
      if (boundedOffset === descriptor.start) {
        return {
          key: paragraphKey,
          offset: descriptor.index,
          type: 'element',
        };
      }

      if (boundedOffset === end) {
        const nextDescriptor = descriptors[descriptor.index + 1];
        if (nextDescriptor?.type === 'text' && nextDescriptor.length === 0) {
          return {
            key: nextDescriptor.key,
            offset: 0,
            type: 'text',
          };
        }
        return {
          key: paragraphKey,
          offset: descriptor.index + 1,
          type: 'element',
        };
      }
    }
  }

  return {
    key: paragraphKey,
    offset: paragraphSize,
    type: 'element',
  };
}

function getOffsetFromElementPoint(point: ElementPoint): number {
  const { descriptors, paragraphKey, totalLength } = getComposerLeafDescriptors();

  if (point.key === paragraphKey) {
    const previous = descriptors[point.offset - 1];
    return previous ? previous.start + previous.length : 0;
  }

  const descriptor = descriptors.find((item) => item.key === point.key);
  if (!descriptor) {
    return totalLength;
  }

  return descriptor.start + Math.min(point.offset, descriptor.length);
}

function getOffsetFromPoint(point: PointType): number {
  if (point.type === 'element') {
    return getOffsetFromElementPoint(point);
  }

  const { descriptors, totalLength } = getComposerLeafDescriptors();
  const descriptor = descriptors.find((item) => item.key === point.key);
  if (!descriptor) {
    return totalLength;
  }

  return descriptor.start + Math.min(point.offset, descriptor.length);
}

function readNodesFromEditor(): ChatComposerNode[] {
  const { descriptors } = getComposerLeafDescriptors();
  const nextNodes: ChatComposerNode[] = [];
  let textBuffer = '';
  let textId = '';

  const flushTextBuffer = (): void => {
    if (textBuffer.length === 0) {
      return;
    }
    nextNodes.push({
      id: textId,
      type: 'text',
      text: textBuffer,
    });
    textBuffer = '';
    textId = '';
  };

  for (const descriptor of descriptors) {
    if (descriptor.type === 'text') {
      if (textBuffer.length === 0) {
        textId = descriptor.key;
      }
      textBuffer += descriptor.text;
      continue;
    }

    if (descriptor.type === 'linebreak') {
      if (textBuffer.length === 0) {
        textId = descriptor.key;
      }
      textBuffer += '\n';
      continue;
    }

    flushTextBuffer();
    const tokenNode = descriptor.node as ChatComposerTokenNode;
    nextNodes.push({
      id: tokenNode.getComposerId(),
      label: tokenNode.getLabel(),
      tokenKey: tokenNode.getTokenKey(),
      tokenKind: tokenNode.getTokenKind(),
      type: 'token',
    });
  }

  flushTextBuffer();
  return normalizeChatComposerNodes(nextNodes);
}

export function readChatComposerSnapshotFromEditorState(
  editorState: EditorState,
): ChatComposerEditorSnapshot {
  return editorState.read(() => {
    const selection = $getSelection();
    const nodes = readNodesFromEditor();

    if (!$isRangeSelection(selection)) {
      return {
        nodes,
        selection: null,
      };
    }

    return {
      nodes,
      selection: {
        start: Math.min(getOffsetFromPoint(selection.anchor), getOffsetFromPoint(selection.focus)),
        end: Math.max(getOffsetFromPoint(selection.anchor), getOffsetFromPoint(selection.focus)),
      },
    };
  });
}

export function writeChatComposerStateToLexicalRoot(
  nodes: ChatComposerNode[],
  selection: ChatComposerSelection | null,
): void {
  const root = $getRoot();
  root.clear();

  const paragraph = $createParagraphNode();
  root.append(paragraph);

  for (const node of normalizeChatComposerNodes(nodes)) {
    if (node.type === 'token') {
      paragraph.append(
        $createChatComposerTokenNode({
          composerId: node.id,
          label: node.label,
          tokenKey: node.tokenKey,
          tokenKind: node.tokenKind,
        }),
      );
      continue;
    }

    const parts = node.text.split('\n');
    for (const [index, part] of parts.entries()) {
      if (part.length > 0) {
        paragraph.append($createTextNode(part));
      }
      if (index < parts.length - 1) {
        paragraph.append($createLineBreakNode());
      }
    }
  }

  if ($isChatComposerTokenNode(paragraph.getLastChild())) {
    paragraph.append($createTextNode(''));
  }

  if (!selection) {
    return;
  }

  const nextSelection = $createRangeSelection();
  const anchor = buildSelectionPointFromOffset(selection.start);
  const focus = buildSelectionPointFromOffset(selection.end);
  nextSelection.anchor.set(anchor.key, anchor.offset, anchor.type);
  nextSelection.focus.set(focus.key, focus.offset, focus.type);
  $setSelection(nextSelection);
}

export function syncLexicalEditorFromChatComposerState(
  editor: LexicalEditor,
  nodes: ChatComposerNode[],
  selection: ChatComposerSelection | null,
): void {
  editor.update(() => {
    writeChatComposerStateToLexicalRoot(nodes, selection);
  });
}

export function syncLexicalSelectionFromChatComposerSelection(
  editor: LexicalEditor,
  selection: ChatComposerSelection,
): void {
  editor.update(() => {
    const nextSelection = $createRangeSelection();
    const anchor = buildSelectionPointFromOffset(selection.start);
    const focus = buildSelectionPointFromOffset(selection.end);
    nextSelection.anchor.set(anchor.key, anchor.offset, anchor.type);
    nextSelection.focus.set(focus.key, focus.offset, focus.type);
    $setSelection(nextSelection);
  });
}
