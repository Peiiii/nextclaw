import {
  $applyNodeReplacement,
  $getNodeByKey,
  DecoratorNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
} from 'lexical';
import type { ReactElement } from 'react';
import { CHAT_COMPOSER_TOKEN_PLACEHOLDER } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';
import {
  buildChatComposerTokenClassName,
  ChatComposerTokenView,
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/lexical/views/chat-composer-token-view';
import type {
  ChatComposerTokenData,
  ChatComposerTokenKind,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

type SerializedChatComposerTokenNode = SerializedLexicalNode & {
  composerId: string;
  data?: ChatComposerTokenData;
  label: string;
  previewUrl?: string;
  tokenKey: string;
  tokenKind: ChatComposerTokenKind;
  type: 'chat-composer-token';
  version: 1;
};

export class ChatComposerTokenNode extends DecoratorNode<ReactElement> {
  __composerId: string;
  __data?: ChatComposerTokenData;
  __tokenKind: ChatComposerTokenKind;
  __tokenKey: string;
  __label: string;
  __previewUrl?: string;

  static getType(): string {
    return 'chat-composer-token';
  }

  static clone(node: ChatComposerTokenNode): ChatComposerTokenNode {
    return new ChatComposerTokenNode(
      node.__composerId,
      node.__tokenKind,
      node.__tokenKey,
      node.__label,
      node.__previewUrl,
      node.__data,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedChatComposerTokenNode): ChatComposerTokenNode {
    return $createChatComposerTokenNode({
      composerId: serializedNode.composerId,
      data: serializedNode.data,
      label: serializedNode.label,
      previewUrl: serializedNode.previewUrl,
      tokenKey: serializedNode.tokenKey,
      tokenKind: serializedNode.tokenKind,
    });
  }

  constructor(
    composerId: string,
    tokenKind: ChatComposerTokenKind,
    tokenKey: string,
    label: string,
    previewUrl?: string,
    data?: ChatComposerTokenData,
    key?: NodeKey,
  ) {
    super(key);
    this.__composerId = composerId;
    this.__tokenKind = tokenKind;
    this.__tokenKey = tokenKey;
    this.__label = label;
    this.__previewUrl = previewUrl;
    this.__data = data;
  }

  private readonly applyTokenDom = (element: HTMLElement): void => {
    element.contentEditable = 'false';
    element.dataset.composerNodeId = this.__composerId;
    element.dataset.composerNodeType = 'token';
    element.dataset.composerTokenKind = this.__tokenKind;
    element.dataset.composerTokenKey = this.__tokenKey;
    element.dataset.composerLabel = this.__label;
    if (this.__tokenKind === 'workspace_excerpt') {
      element.removeAttribute('title');
    } else {
      element.title = this.__label;
    }
    element.className = buildChatComposerTokenClassName(this.__tokenKind);
  };

  createDOM = (_config: EditorConfig, _editor: LexicalEditor): HTMLElement => {
    const element = document.createElement('span');
    this.applyTokenDom(element);
    return element;
  };

  updateDOM = (_prevNode: ChatComposerTokenNode, dom: HTMLElement): false => {
    this.applyTokenDom(dom);
    return false;
  };

  decorate = (editor: LexicalEditor): ReactElement => {
    const nodeKey = this.getKey();
    return (
      <ChatComposerTokenView
        data={this.__data}
        label={this.__label}
        onRemove={() => {
          editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if (!$isChatComposerTokenNode(node)) {
              return;
            }
            node.selectNext();
            node.remove();
          });
          editor.focus();
        }}
        previewUrl={this.__previewUrl}
        tokenKey={this.__tokenKey}
        tokenKind={this.__tokenKind}
      />
    );
  };

  exportJSON = (): SerializedChatComposerTokenNode => {
    return {
      composerId: this.__composerId,
      data: this.__data,
      label: this.__label,
      previewUrl: this.__previewUrl,
      tokenKey: this.__tokenKey,
      tokenKind: this.__tokenKind,
      type: 'chat-composer-token',
      version: 1,
    };
  };

  getComposerId = (): string => {
    return this.getLatest().__composerId;
  };

  getTokenKind = (): ChatComposerTokenKind => {
    return this.getLatest().__tokenKind;
  };

  getTokenKey = (): string => {
    return this.getLatest().__tokenKey;
  };

  getLabel = (): string => {
    return this.getLatest().__label;
  };

  getPreviewUrl = (): string | undefined => {
    return this.getLatest().__previewUrl;
  };

  getData = (): ChatComposerTokenData | undefined => {
    return this.getLatest().__data;
  };

  getTextContent = (): string => {
    return CHAT_COMPOSER_TOKEN_PLACEHOLDER;
  };

  isInline = (): true => {
    return true;
  };

  isIsolated = (): true => {
    return true;
  };

  isKeyboardSelectable = (): boolean => {
    return false;
  };
}

export function $createChatComposerTokenNode(params: {
  composerId: string;
  data?: ChatComposerTokenData;
  label: string;
  previewUrl?: string;
  tokenKey: string;
  tokenKind: ChatComposerTokenKind;
}): ChatComposerTokenNode {
  const { composerId, data, label, previewUrl, tokenKey, tokenKind } = params;
  return $applyNodeReplacement(
    new ChatComposerTokenNode(composerId, tokenKind, tokenKey, label, previewUrl, data),
  );
}

export function $isChatComposerTokenNode(
  node: LexicalNode | null | undefined,
): node is ChatComposerTokenNode {
  return node instanceof ChatComposerTokenNode;
}
