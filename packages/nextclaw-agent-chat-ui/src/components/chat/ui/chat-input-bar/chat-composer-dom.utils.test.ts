import { readComposerSelection, restoreComposerSelection } from './chat-composer-dom.utils';
import { createChatComposerTextNode, createChatComposerTokenNode } from './chat-composer.utils';

describe('chat composer dom utils', () => {
  it('reads the caret offset from a raw text node inserted directly under the contenteditable root', () => {
    const root = document.createElement('div');
    const textNode = document.createTextNode('/');
    root.appendChild(textNode);
    document.body.appendChild(root);

    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(textNode, 1);
    range.setEnd(textNode, 1);
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(readComposerSelection(root, [createChatComposerTextNode('/')])).toEqual({
      start: 1,
      end: 1
    });

    document.body.removeChild(root);
  });

  it('round-trips a caret that should sit to the right of a token node', () => {
    const leading = createChatComposerTextNode('He');
    const token = createChatComposerTokenNode({ tokenKind: 'file', tokenKey: 'sample-image', label: 'sample.png' });
    const trailing = createChatComposerTextNode('llo');
    const nodes = [leading, token, trailing];
    const root = document.createElement('div');

    const leadingElement = document.createElement('span');
    leadingElement.dataset.composerNodeId = leading.id;
    leadingElement.dataset.composerNodeType = 'text';
    leadingElement.textContent = leading.text;
    root.appendChild(leadingElement);

    const tokenElement = document.createElement('span');
    tokenElement.dataset.composerNodeId = token.id;
    tokenElement.dataset.composerNodeType = 'token';
    tokenElement.dataset.composerTokenKind = token.tokenKind;
    tokenElement.dataset.composerTokenKey = token.tokenKey;
    tokenElement.dataset.composerLabel = token.label;
    tokenElement.textContent = token.label;
    root.appendChild(tokenElement);

    const trailingElement = document.createElement('span');
    trailingElement.dataset.composerNodeId = trailing.id;
    trailingElement.dataset.composerNodeType = 'text';
    trailingElement.textContent = trailing.text;
    root.appendChild(trailingElement);

    document.body.appendChild(root);
    restoreComposerSelection(root, nodes, { start: 3, end: 3 });

    expect(readComposerSelection(root, nodes)).toEqual({
      start: 3,
      end: 3
    });

    document.body.removeChild(root);
  });
});
