import { createEditor } from 'lexical';
import { describe, expect, it, vi } from 'vitest';
import { createChatComposerTextNode, createChatComposerTokenNode, serializeChatComposerPlainText } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';
import { writeChatComposerStateToLexicalRoot, readChatComposerSnapshotFromEditorState } from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-lexical-adapter';
import { ChatComposerTokenNode } from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/chat-composer-token-node';
import { ChatComposerLexicalOwner } from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/owners/chat-composer-lexical-owner';

function fixture(selection = { start: 6, end: 6 }) {
  const editor = createEditor({ namespace: 'dictation-test', nodes: [ChatComposerTokenNode], onError: (e) => { throw e; } });
  const root = document.createElement('div');
  root.contentEditable = 'true';
  document.body.append(root);
  editor.setRootElement(root);
  const reference = createChatComposerTokenNode({ tokenKind: 'file', tokenKey: 'a', label: 'a.txt' });
  const nodes = [createChatComposerTextNode('hello world'), reference];
  editor.update(() => writeChatComposerStateToLexicalRoot(nodes, selection), { discrete: true });
  const owner = new ChatComposerLexicalOwner();
  const onNodesChange = vi.fn();
  owner.configureRuntime({ fallbackNodes: nodes, callbacks: { onNodesChange },
    actions: { onSend: vi.fn(), onStop: vi.fn(), isSending: false, canStopGeneration: false } });
  const unbind = owner.bindEditor(editor);
  const unregister = owner.registerEditorListeners(editor);
  const interrupt = vi.fn();
  const session = owner.createHandle().beginDictation(interrupt)!;
  const read = () => readChatComposerSnapshotFromEditorState(editor.getEditorState());
  return { editor, root, owner, session, interrupt, reference, read, onNodesChange,
    text: () => serializeChatComposerPlainText(read().nodes),
    dispose: () => { unbind(); unregister(); editor.setRootElement(null); root.remove(); } };
}

describe('inline dictation edit', () => {
  it('replaces and shortens interim text at the caret, then removes only its underline', () => {
    const f = fixture();
    try {
      f.session.update('', 'beautiful ');
      expect(f.onNodesChange).not.toHaveBeenCalled();
      expect(f.text()).toBe('hello beautiful world');
      expect(f.root.querySelector('[style*="underline"]')?.textContent).toBe('beautiful ');
      f.session.update('', 'new ');
      expect(f.text()).toBe('hello new world');
      f.session.commit('great ');
      expect(f.onNodesChange).toHaveBeenCalledOnce();
      expect(f.text()).toBe('hello great world');
      expect(f.root.querySelector('[style*="underline"]')).toBeNull();
      expect(f.read().nodes.at(-1)).toMatchObject({ tokenKey: 'a' });
      f.session.update('', 'late');
      expect(f.text()).toBe('hello great world');
    } finally { f.dispose(); }
  });
  it('restores a replaced selection and reference on cancellation', () => {
    const f = fixture({ start: 0, end: 6 });
    try {
      f.session.update('', 'new ');
      expect(f.text()).toBe('new world');
      f.session.cancel();
      expect(f.text()).toBe('hello world');
      expect(f.read().selection).toEqual({ start: 0, end: 6 });
      expect(f.read().nodes.at(-1)).toMatchObject({ tokenKey: 'a' });
    } finally { f.dispose(); }
  });
  it.each(['pointerdown', 'beforeinput', 'paste', 'compositionstart'])('hands editing back on %s and ignores late updates', (event) => {
    const f = fixture();
    try {
      f.session.update('', 'new ');
      f.root.dispatchEvent(new Event(event, { bubbles: true }));
      expect(f.interrupt).toHaveBeenCalledOnce();
      expect(f.root.querySelector('[style*="underline"]')).toBeNull();
      f.session.update('overwritten', '');
      f.session.cancel();
      expect(f.text()).toBe('hello new world');
    } finally { f.dispose(); }
  });
  it('Escape cancels instead of sending or preserving provisional text', () => {
    const f = fixture();
    try {
      f.session.update('', 'new ');
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      f.root.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(f.text()).toBe('hello world');
      expect(f.interrupt).toHaveBeenCalledOnce();
    } finally { f.dispose(); }
  });
  it('does not publish removed references during preview or cancellation', () => {
    const f = fixture({ start: 0, end: 12 });
    try {
      f.session.update('', 'replacement');
      expect(f.onNodesChange).not.toHaveBeenCalled();
      f.session.cancel();
      expect(f.onNodesChange).not.toHaveBeenCalled();
      expect(f.read().nodes.at(-1)).toMatchObject({ tokenKey: 'a' });
    } finally { f.dispose(); }
  });
  it('abandons dictation when an external draft replaces the document', async () => {
    const f = fixture();
    try {
      f.session.update('', 'preview');
      f.owner.syncExternalState(f.editor, [createChatComposerTextNode('another draft')]);
      await Promise.resolve();
      f.session.commit('late');
      expect(f.text()).toBe('another draft');
      expect(f.interrupt).toHaveBeenCalledOnce();
    } finally { f.dispose(); }
  });
});
