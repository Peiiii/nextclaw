import {
  $applyNodeReplacement,
  DecoratorNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
} from 'lexical';
import type { ReactElement } from 'react';
import { AppWindow, FileText, Folder, ImageIcon, Puzzle } from 'lucide-react';
import { CHAT_COMPOSER_TOKEN_PLACEHOLDER } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';
import type { ChatComposerTokenKind } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

type SerializedChatComposerTokenNode = SerializedLexicalNode & {
  composerId: string;
  label: string;
  tokenKey: string;
  tokenKind: ChatComposerTokenKind;
  type: 'chat-composer-token';
  version: 1;
};

function buildTokenClassName(tokenKind: ChatComposerTokenKind): string {
  if (tokenKind === 'file') {
    return [
      'mx-[2px]',
      'inline-flex',
      'h-7',
      'max-w-[min(100%,17rem)]',
      'items-center',
      'gap-1.5',
      'rounded-lg',
      'border',
      'border-border',
      'bg-muted',
      'px-2',
      'align-baseline',
      'text-foreground',
      'transition-[border-color,background-color,box-shadow,color]',
      'duration-150',
    ].join(' ');
  }

  return [
    'mx-[2px]',
    'inline-flex',
    'h-7',
    'max-w-full',
    'items-center',
    'gap-1.5',
    'rounded-lg',
    'border',
    'border-primary/12',
    'bg-primary/8',
    'px-2',
    'align-baseline',
    'text-[11px]',
    'font-medium',
    'text-primary',
    'transition',
  ].join(' ');
}

function ChatComposerTokenChip({
  label,
  tokenKind,
}: {
  label: string;
  tokenKind: ChatComposerTokenKind;
}): ReactElement {
  const isWorkspaceReference = tokenKind === 'workspace_file' || tokenKind === 'workspace_directory';
  return (
    <>
      <span
        className={
          tokenKind === 'file'
            ? 'inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md bg-card text-muted-foreground ring-1 ring-border'
            : 'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-primary/70'
        }
      >
        {tokenKind === 'file' ? (
          <ImageIcon aria-hidden="true" className="h-3 w-3" />
        ) : tokenKind === 'workspace_file' ? (
          <FileText aria-hidden="true" className="h-3 w-3" />
        ) : tokenKind === 'workspace_directory' ? (
          <Folder aria-hidden="true" className="h-3 w-3" />
        ) : tokenKind === 'panel_app' ? (
          <AppWindow aria-hidden="true" className="h-3 w-3" />
        ) : (
          <Puzzle aria-hidden="true" className="h-3 w-3" />
        )}
      </span>
      <span
        className={
          tokenKind === 'file'
            ? 'min-w-0 flex-1 truncate text-[12px] font-medium text-foreground'
            : isWorkspaceReference
              ? 'max-w-[16rem] truncate'
              : 'truncate'
        }
      >
        {label}
      </span>
    </>
  );
}

export class ChatComposerTokenNode extends DecoratorNode<ReactElement> {
  __composerId: string;
  __tokenKind: ChatComposerTokenKind;
  __tokenKey: string;
  __label: string;

  static getType(): string {
    return 'chat-composer-token';
  }

  static clone(node: ChatComposerTokenNode): ChatComposerTokenNode {
    return new ChatComposerTokenNode(
      node.__composerId,
      node.__tokenKind,
      node.__tokenKey,
      node.__label,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedChatComposerTokenNode): ChatComposerTokenNode {
    return $createChatComposerTokenNode({
      composerId: serializedNode.composerId,
      label: serializedNode.label,
      tokenKey: serializedNode.tokenKey,
      tokenKind: serializedNode.tokenKind,
    });
  }

  constructor(
    composerId: string,
    tokenKind: ChatComposerTokenKind,
    tokenKey: string,
    label: string,
    key?: NodeKey,
  ) {
    super(key);
    this.__composerId = composerId;
    this.__tokenKind = tokenKind;
    this.__tokenKey = tokenKey;
    this.__label = label;
  }

  private readonly applyTokenDom = (element: HTMLElement): void => {
    element.contentEditable = 'false';
    element.dataset.composerNodeId = this.__composerId;
    element.dataset.composerNodeType = 'token';
    element.dataset.composerTokenKind = this.__tokenKind;
    element.dataset.composerTokenKey = this.__tokenKey;
    element.dataset.composerLabel = this.__label;
    element.title = this.__label;
    element.className = buildTokenClassName(this.__tokenKind);
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

  decorate = (): ReactElement => {
    return <ChatComposerTokenChip label={this.__label} tokenKind={this.__tokenKind} />;
  };

  exportJSON = (): SerializedChatComposerTokenNode => {
    return {
      composerId: this.__composerId,
      label: this.__label,
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
  label: string;
  tokenKey: string;
  tokenKind: ChatComposerTokenKind;
}): ChatComposerTokenNode {
  const { composerId, label, tokenKey, tokenKind } = params;
  return $applyNodeReplacement(
    new ChatComposerTokenNode(composerId, tokenKind, tokenKey, label),
  );
}

export function $isChatComposerTokenNode(
  node: LexicalNode | null | undefined,
): node is ChatComposerTokenNode {
  return node instanceof ChatComposerTokenNode;
}
