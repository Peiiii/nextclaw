import { createContext, useContext, useState, type ReactElement, type ReactNode } from 'react';
import { X } from 'lucide-react';
import {
  CHAT_REFERENCE_TAG_CLASS_NAME,
  ChatReferenceIcon,
  ChatReferenceTagContent,
  ChatReferenceTagPreview,
  resolveWorkspaceExcerptTagMetric,
} from '@agent-chat-ui/components/chat/ui/chat-reference-tag';
import { ChatUiPrimitives } from '@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives';
import type {
  ChatComposerTokenData,
  ChatComposerTokenKind,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

const ChatComposerTokenUiContext = createContext<{
  excerptCharacterCountTemplate?: string;
  removeTokenLabel?: string;
}>({});

export function ChatComposerTokenUiProvider({
  children,
  excerptCharacterCountTemplate,
  removeTokenLabel,
}: {
  children: ReactNode;
  excerptCharacterCountTemplate?: string;
  removeTokenLabel?: string;
}) {
  return (
    <ChatComposerTokenUiContext.Provider value={{ excerptCharacterCountTemplate, removeTokenLabel }}>
      {children}
    </ChatComposerTokenUiContext.Provider>
  );
}

export function buildChatComposerTokenClassName(tokenKind: ChatComposerTokenKind): string {
  const composerClassNames = [
    'selection:bg-transparent',
    'selection:text-current',
    'group/composer-token',
    'data-[composer-selected=true]:shadow-[0_0_0_2px_var(--interaction-selection,Highlight)]',
  ];
  if (tokenKind === 'file') {
    return [
      'mx-[2px] inline-flex h-6 items-center gap-1.5 rounded-[7px] border px-1.5 align-middle leading-none',
      ...composerClassNames,
      'max-w-[min(100%,17rem)]',
      'border-border',
      'bg-muted',
      'text-foreground',
    ].join(' ');
  }
  return [CHAT_REFERENCE_TAG_CLASS_NAME, ...composerClassNames].join(' ');
}

function WorkspaceExcerptComposerContent({ data, label }: {
  data?: ChatComposerTokenData;
  label: string;
}) {
  const { excerptCharacterCountTemplate } = useContext(ChatComposerTokenUiContext);
  const excerpt = typeof data?.excerpt === 'string' ? data.excerpt : '';
  const path = typeof data?.path === 'string' ? data.path : null;
  const startLine = typeof data?.startLine === 'number' ? data.startLine : null;
  const endLine = typeof data?.endLine === 'number' ? data.endLine : null;
  const { characterCountLabel, location, metricLabel } = resolveWorkspaceExcerptTagMetric({
    characterCountTemplate: excerptCharacterCountTemplate,
    endLine,
    excerpt,
    startLine,
  });
  const previewTrigger = (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <ChatReferenceTagContent
        excerpt={excerpt}
        kind="workspace_excerpt"
        label={label}
        metricLabel={metricLabel}
        source={path}
      />
    </span>
  );
  return excerpt ? (
    <ChatReferenceTagPreview
      excerpt={excerpt}
      characterCountLabel={characterCountLabel}
      label={label}
      location={location}
      path={path}
    >
      {previewTrigger}
    </ChatReferenceTagPreview>
  ) : previewTrigger;
}

function ConversationExcerptComposerContent({ data, label }: {
  data?: ChatComposerTokenData;
  label: string;
}) {
  const excerpt = typeof data?.excerpt === 'string' ? data.excerpt : '';
  const previewTrigger = (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <ChatReferenceTagContent
        excerpt={excerpt}
        kind="conversation_excerpt"
        label={label}
      />
    </span>
  );
  return excerpt ? (
    <ChatReferenceTagPreview
      excerpt={excerpt}
      kind="conversation_excerpt"
      label={label}
    >
      {previewTrigger}
    </ChatReferenceTagPreview>
  ) : previewTrigger;
}

function ComposerTokenHoverActions({ children, onRemove }: {
  children: ReactElement;
  onRemove: () => void;
}) {
  const { removeTokenLabel } = useContext(ChatComposerTokenUiContext);
  const [hasFocusWithin, setHasFocusWithin] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  if (!removeTokenLabel) {
    return children;
  }
  const showRemoveAction = hasFocusWithin || isHovered;
  const { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } = ChatUiPrimitives;
  return (
    <span
      className="relative -mx-1.5 inline-flex h-full min-w-0 items-center px-1.5"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHasFocusWithin(false);
        }
      }}
      onFocus={() => setHasFocusWithin(true)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        className={`inline-flex h-full min-w-0 items-center gap-1.5 ${showRemoveAction
          ? '[mask-image:linear-gradient(to_right,black_calc(100%_-_2.5rem),transparent_calc(100%_-_1.25rem))] [-webkit-mask-image:linear-gradient(to_right,black_calc(100%_-_2.5rem),transparent_calc(100%_-_1.25rem))]'
          : ''}`}
        data-composer-token-content="true"
      >
        {children}
      </span>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={removeTokenLabel}
              className={`${showRemoveAction ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'} absolute right-0.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-transparent text-muted-foreground transition-[background-color,border-color,color,opacity] hover:border-border hover:bg-[var(--interaction-hover)] hover:text-accent-foreground focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35`}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRemove();
              }}
            >
              <X aria-hidden="true" className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {removeTokenLabel}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}

export function ChatComposerTokenView({
  data,
  label,
  onRemove,
  previewUrl,
  tokenKey,
  tokenKind,
}: {
  data?: ChatComposerTokenData;
  label: string;
  onRemove: () => void;
  previewUrl?: string;
  tokenKey: string;
  tokenKind: ChatComposerTokenKind;
}): ReactElement {
  const [previewFailed, setPreviewFailed] = useState(false);
  let content: ReactElement;
  if (tokenKind === 'workspace_excerpt') {
    content = <WorkspaceExcerptComposerContent data={data} label={label} />;
  } else if (tokenKind === 'conversation_excerpt') {
    content = <ConversationExcerptComposerContent data={data} label={label} />;
  } else if (tokenKind !== 'file') {
    const source = typeof data?.path === 'string' ? data.path : tokenKey;
    content = <ChatReferenceTagContent kind={tokenKind} label={label} source={source} />;
  } else {
    content = (
      <>
        <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-card text-muted-foreground ring-1 ring-border">
          <ChatReferenceIcon className="h-3 w-3" kind="file" source={label} />
          {previewUrl && !previewFailed ? (
            <img
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setPreviewFailed(true)}
              src={previewUrl}
            />
          ) : null}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">
          {label}
        </span>
      </>
    );
  }
  return (
    <ComposerTokenHoverActions onRemove={onRemove}>
      {content}
    </ComposerTokenHoverActions>
  );
}
