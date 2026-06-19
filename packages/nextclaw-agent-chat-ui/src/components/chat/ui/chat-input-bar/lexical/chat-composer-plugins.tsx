import { useEffect, useLayoutEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type {
  ChatComposerNode,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import type { ChatComposerLexicalOwner } from './owners/chat-composer-lexical-owner';

type ChatComposerBindingsPluginProps = {
  disabled: boolean;
  nodes: ChatComposerNode[];
  owner: ChatComposerLexicalOwner;
};

export function ChatComposerBindingsPlugin(
  {
    disabled,
    nodes,
    owner,
  }: ChatComposerBindingsPluginProps,
): null {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    return owner.bindEditor(editor);
  }, [editor, owner]);

  useLayoutEffect(() => {
    editor.setEditable(!disabled);
    owner.syncExternalState(editor, nodes);
  }, [disabled, editor, nodes, owner]);

  useEffect(() => {
    return owner.registerEditorListeners(editor);
  }, [editor, owner]);

  return null;
}
