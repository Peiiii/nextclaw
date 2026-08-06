import {
  $applyNodeReplacement,
  DecoratorNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
} from 'lexical';
import { useState, type ReactElement } from 'react';
import { AppWindow, FileText, Folder, FolderKanban, ImageIcon, Puzzle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CHAT_COMPOSER_TOKEN_PLACEHOLDER } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';
import type { ChatComposerTokenKind } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

type SerializedChatComposerTokenNode = SerializedLexicalNode & {
  composerId: string;
  label: string;
  previewUrl?: string;
  tokenKey: string;
  tokenKind: ChatComposerTokenKind;
  type: 'chat-composer-token';
  version: 1;
};

const CHAT_COMPOSER_TOKEN_ICONS: Record<string, LucideIcon> = {
  file: ImageIcon,
  panel_app: AppWindow,
  project: FolderKanban,
  workspace_directory: Folder,
  workspace_file: FileText,
};

function buildTokenClassName(tokenKind: ChatComposerTokenKind): string {
  const sharedClassNames = [
    'mx-[2px]',
    'inline-flex',
    'h-6',
    'items-center',
    'gap-1.5',
    'rounded-[7px]',
    'border',
    'px-1.5',
    'align-middle',
    'leading-none',
    'selection:bg-transparent',
    'selection:text-current',
    'data-[composer-selected=true]:shadow-[0_0_0_2px_var(--interaction-selection,Highlight)]',
  ];

  if (tokenKind === 'file') {
    return [
      ...sharedClassNames,
      'max-w-[min(100%,17rem)]',
      'border-border',
      'bg-muted',
      'text-foreground',
    ].join(' ');
  }

  return [
    ...sharedClassNames,
    'max-w-full',
    'border-primary/12',
    'bg-primary/8',
    'text-[11px]',
    'font-medium',
    'text-primary',
  ].join(' ');
}

function ChatComposerTokenChip({
  label,
  previewUrl,
  tokenKind,
}: {
  label: string;
  previewUrl?: string;
  tokenKind: ChatComposerTokenKind;
}): ReactElement {
  const isWorkspaceReference = tokenKind === 'workspace_file' || tokenKind === 'workspace_directory';
  const [previewFailed, setPreviewFailed] = useState(false);
  const TokenIcon = CHAT_COMPOSER_TOKEN_ICONS[tokenKind] ?? Puzzle;
  return (
    <>
      <span
        className={
          tokenKind === 'file'
            ? 'inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-card text-muted-foreground ring-1 ring-border'
            : 'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-primary/70'
        }
      >
        {previewUrl && !previewFailed ? (
          <img
            alt=""
            className="h-full w-full object-cover"
            onError={() => setPreviewFailed(true)}
            src={previewUrl}
          />
        ) : (
          <TokenIcon aria-hidden="true" className="h-3 w-3" />
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
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedChatComposerTokenNode): ChatComposerTokenNode {
    return $createChatComposerTokenNode({
      composerId: serializedNode.composerId,
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
    key?: NodeKey,
  ) {
    super(key);
    this.__composerId = composerId;
    this.__tokenKind = tokenKind;
    this.__tokenKey = tokenKey;
    this.__label = label;
    this.__previewUrl = previewUrl;
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
    return (
      <ChatComposerTokenChip
        label={this.__label}
        previewUrl={this.__previewUrl}
        tokenKind={this.__tokenKind}
      />
    );
  };

  exportJSON = (): SerializedChatComposerTokenNode => {
    return {
      composerId: this.__composerId,
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
  previewUrl?: string;
  tokenKey: string;
  tokenKind: ChatComposerTokenKind;
}): ChatComposerTokenNode {
  const { composerId, label, previewUrl, tokenKey, tokenKind } = params;
  return $applyNodeReplacement(
    new ChatComposerTokenNode(composerId, tokenKind, tokenKey, label, previewUrl),
  );
}

export function $isChatComposerTokenNode(
  node: LexicalNode | null | undefined,
): node is ChatComposerTokenNode {
  return node instanceof ChatComposerTokenNode;
}
