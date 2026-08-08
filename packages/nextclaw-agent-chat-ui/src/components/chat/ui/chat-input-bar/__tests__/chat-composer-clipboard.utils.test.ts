import {
  createChatComposerTextNode,
  createChatComposerTokenNode,
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';
import {
  parseChatComposerClipboard,
  serializeChatComposerClipboard,
  serializeChatComposerClipboardPlainText,
  sliceChatComposerRange,
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-clipboard.utils';

const sourceNodes = [
  createChatComposerTextNode('before '),
  createChatComposerTokenNode({
    tokenKind: 'workspace_file',
    tokenKey: 'docs/guide.md',
    label: 'guide.md',
    data: { path: 'docs/guide.md' },
  }),
  createChatComposerTextNode(' and '),
  createChatComposerTokenNode({
    tokenKind: 'workspace_excerpt',
    tokenKey: 'docs/guide.md#excerpt-1',
    label: 'guide.md',
    data: {
      path: 'docs/guide.md',
      excerpt: 'Selected source text.',
      startLine: 12,
      endLine: 13,
    },
  }),
  createChatComposerTextNode(' after'),
];

it('slices mixed text and tokens without retaining composer node identities', () => {
  const selected = sliceChatComposerRange(sourceNodes, 3, 14);

  expect(selected.map((node) => node.type === 'text' ? node.text : node.label)).toEqual([
    'ore ',
    'guide.md',
    ' and ',
    'guide.md',
  ]);
  expect(selected[1]?.id).not.toBe(sourceNodes[1]?.id);
  expect(selected[3]?.id).not.toBe(sourceNodes[3]?.id);
});

it('round-trips every structured token field through the private clipboard format', () => {
  const serialized = serializeChatComposerClipboard(sourceNodes);
  const restored = parseChatComposerClipboard(serialized);

  expect(restored?.map(({ id: _id, ...node }) => node)).toEqual(
    sourceNodes.map(({ id: _id, ...node }) => node),
  );
  expect(restored?.every((node, index) => node.id !== sourceNodes[index]?.id)).toBe(true);
});

it('rejects malformed structured data instead of guessing token fields', () => {
  expect(parseChatComposerClipboard('{"version":1,"nodes":[{"type":"token"}]}')).toBeNull();
  expect(parseChatComposerClipboard('{"version":2,"nodes":[]}')).toBeNull();
  expect(parseChatComposerClipboard('not json')).toBeNull();
});

it('exports readable text for external applications', () => {
  expect(serializeChatComposerClipboardPlainText(sourceNodes)).toBe(
    'before @guide.md and [guide.md L12–13]\nSelected source text. after',
  );
});
