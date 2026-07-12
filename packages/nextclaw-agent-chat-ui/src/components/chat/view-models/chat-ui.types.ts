import type {
  ChatInputSurfaceConfig,
  ChatInputSurfaceItem,
  ChatInputSurfaceMenuProps,
  ChatInputSurfaceTrigger,
  ChatInputSurfaceTriggerSpec,
} from '@agent-chat-ui/lib/input-surface';
import type { ReactNode } from 'react';

export type {
  ChatInputSurfaceConfig,
  ChatInputSurfaceItem,
  ChatInputSurfaceMenuProps,
  ChatInputSurfaceMenuTexts,
  ChatInputSurfaceTrigger,
  ChatInputSurfaceTriggerChangeReason,
  ChatInputSurfaceTriggerSpec,
} from '@agent-chat-ui/lib/input-surface';

export type ChatTexts = {
  slashLoadingLabel: string;
  slashSectionLabel: string;
  slashEmptyLabel: string;
  slashHintLabel: string;
  slashSkillHintLabel: string;
  sendButtonLabel: string;
  stopButtonLabel: string;
};

export type ChatSlashItem = ChatInputSurfaceItem;

export type ChatSelectedItem = {
  key: string;
  label: string;
};

export type ChatComposerTokenKind = "skill" | "file" | "panel_app" | (string & {});

export type ChatComposerTextNode = {
  id: string;
  type: "text";
  text: string;
};

export type ChatComposerTokenNode = {
  id: string;
  type: "token";
  tokenKind: ChatComposerTokenKind;
  tokenKey: string;
  label: string;
};

export type ChatComposerNode = ChatComposerTextNode | ChatComposerTokenNode;

export type ChatComposerSelection = {
  start: number;
  end: number;
};

export type ChatToolbarIcon = "sparkles" | "brain";

export type ChatToolbarAccessoryIcon = ChatToolbarIcon | "paperclip";

export type ChatToolbarSelectOption = {
  value: string;
  label: string;
  description?: string;
};

export type ChatToolbarSelectGroup = {
  key: string;
  label?: string;
  options: ChatToolbarSelectOption[];
};

export type ChatToolbarSelectSearch = {
  placeholder: string;
  emptyLabel?: string;
};

export type ChatToolbarSelectOptionAction = {
  kind: "favorite";
  activeValues: string[];
  activeLabel: string;
  inactiveLabel: string;
  onToggle: (value: string, active: boolean) => void;
};

export type ChatToolbarSelect = {
  key: string;
  value?: string;
  placeholder: string;
  selectedLabel?: string;
  icon?: ChatToolbarIcon;
  options: ChatToolbarSelectOption[];
  groups?: ChatToolbarSelectGroup[];
  disabled?: boolean;
  loading?: boolean;
  emptyLabel?: string;
  search?: ChatToolbarSelectSearch;
  optionAction?: ChatToolbarSelectOptionAction;
  onValueChange: (value: string) => void;
};

export type ChatToolbarAccessory = {
  key: string;
  label: string;
  icon?: ChatToolbarAccessoryIcon;
  iconOnly?: boolean;
  disabled?: boolean;
  tooltip?: string;
  onClick?: () => void;
};

export type ChatSkillPickerOption = {
  key: string;
  label: string;
  description?: string;
  badgeLabel?: string;
};

export type ChatSkillPickerOptionGroup = {
  key: string;
  label?: string;
  options: ChatSkillPickerOption[];
};

export type ChatSkillPickerProps = {
  title: string;
  searchPlaceholder: string;
  emptyLabel: string;
  loadingLabel: string;
  isLoading?: boolean;
  manageLabel?: string;
  manageHref?: string;
  options: ChatSkillPickerOption[];
  groups?: ChatSkillPickerOptionGroup[];
  selectedKeys: string[];
  onSelectedKeysChange: (next: string[]) => void;
};

export type ChatInputBarActionsProps = {
  sendError?: string | null;
  sendErrorDetailsLabel?: string;
  isSending: boolean;
  canStopGeneration: boolean;
  sendDisabled: boolean;
  stopDisabled: boolean;
  stopHint: string;
  sendButtonLabel: string;
  stopButtonLabel: string;
  contextWindow?: ChatContextWindowIndicator | null;
  onSend: () => Promise<void> | void;
  onStop: () => Promise<void> | void;
};

export type ChatContextWindowIndicator = {
  label: string;
  percentLabel: string;
  ratio: number;
  tone: "neutral" | "warning" | "danger";
  details: Array<{ label: string; value: string }>;
};

export type ChatInputBarToolbarProps = {
  selects: ChatToolbarSelect[];
  trailingSelects?: ChatToolbarSelect[];
  accessories?: ChatToolbarAccessory[];
  skillPicker?: ChatSkillPickerProps | null;
  actions: ChatInputBarActionsProps;
};

export type ChatInlineHint = {
  tone: "neutral" | "warning";
  loading?: boolean;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export type ChatSlashMenuProps = Omit<
  ChatInputSurfaceMenuProps,
  "items" | "onSelectItem" | "texts"
> & {
  items: ChatSlashItem[];
  texts: Pick<
    ChatTexts,
    | "slashLoadingLabel"
    | "slashSectionLabel"
    | "slashEmptyLabel"
    | "slashHintLabel"
    | "slashSkillHintLabel"
  >;
  onSelectItem: (item: ChatSlashItem) => void;
};

export type ChatInputBarProps = {
  surface?: 'default' | 'embedded';
  topSlot?: ReactNode;
  composer: {
    nodes: ChatComposerNode[];
    placeholder: string;
    disabled: boolean;
    onNodesChange: (nodes: ChatComposerNode[]) => void;
    onFilesAdd?: (files: File[]) => Promise<void> | void;
    inputSurfaceTriggerSpecs?: ChatInputSurfaceTriggerSpec[];
    onInputSurfaceTriggerChange?: (trigger: ChatInputSurfaceTrigger | null) => void;
  };
  inputSurface?: ChatInputSurfaceConfig;
  slashMenu?: Pick<ChatSlashMenuProps, "filterOptions" | "isLoading" | "items" | "texts"> & {
    onSelectItem?: (item: ChatSlashItem) => void;
  };
  hint?: ChatInlineHint | null;
  toolbar: ChatInputBarToolbarProps;
};

export type ChatMessageRole =
  | "user"
  | "assistant"
  | "tool"
  | "system"
  | "message";

export type ChatFileOperationLineViewModel = {
  kind: "context" | "add" | "remove";
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
};

export type ChatFileOperationBlockViewModel = {
  key: string;
  path: string;
  display?: "preview" | "diff";
  caption?: string;
  lines: ChatFileOperationLineViewModel[];
  fullLines?: ChatFileOperationLineViewModel[];
  rawText?: string;
  languageHint?: string | null;
  beforeText?: string;
  afterText?: string;
  patchText?: string;
  oldStartLine?: number;
  newStartLine?: number;
  truncated?: boolean;
};

export type ChatUiShowContentPurpose = "read" | "preview" | "edit" | "interact";
export type ChatUiShowContentPlacement = "inline" | "side_panel";
export type ChatFilePreviewViewer = "auto" | "source" | "rendered";

export type ChatUiShowContentTarget =
  | {
      type: "file";
      payload: {
        path: string;
        line?: number;
        column?: number;
        viewer?: ChatFilePreviewViewer;
      };
    }
  | {
      type: "url";
      payload: {
        url: string;
      };
    }
  | {
      type: "panel_app";
      payload: {
        appId: string;
      };
    };

export type ChatUiShowContentRequest = {
  target: ChatUiShowContentTarget;
  title?: string;
  purpose?: ChatUiShowContentPurpose;
  placement?: ChatUiShowContentPlacement;
};

export type ChatToolActionViewModel =
  | {
      kind: "open-session";
      sessionId: string;
      sessionKind: "child" | "session";
      agentId?: string;
      label?: string;
      parentSessionId?: string;
    }
  | {
      kind: "show-content";
      label: string;
      request: ChatUiShowContentRequest;
    };

export type ChatFileOpenActionViewModel = {
  path: string;
  label?: string;
  viewMode: "preview" | "diff";
  previewViewer?: ChatFilePreviewViewer;
  line?: number;
  column?: number;
  rawText?: string;
  beforeText?: string;
  afterText?: string;
  patchText?: string;
  oldStartLine?: number;
  newStartLine?: number;
  fullLines?: ChatFileOperationLineViewModel[];
};

export type ChatPanelAppCardViewModel = {
  appId: string;
  title?: string;
  action: Extract<ChatToolActionViewModel, { kind: "show-content" }>;
};

export type ChatInlineDisplayTarget =
  | {
      type: "file";
      payload: {
        path: string;
        line?: number;
        column?: number;
        viewer?: ChatFilePreviewViewer;
      };
    }
  | {
      type: "url";
      payload: {
        url: string;
      };
    }
  | {
      type: "panel_app";
      payload: {
        appId: string;
      };
    }
  | {
      type: "json";
      payload: {
        value: unknown;
      };
    };

export type ChatInlineDisplayViewModel = {
  target: ChatInlineDisplayTarget;
  title?: string;
  description?: string;
};

export type ChatToolPartViewModel = {
  kind: "call" | "result";
  toolName: string;
  agentId?: string;
  summary?: string;
  inputLabel?: string;
  input?: string;
  output?: string;
  outputData?: unknown;
  hasResult: boolean;
  statusTone: "running" | "success" | "error" | "cancelled";
  statusLabel: string;
  titleLabel: string;
  outputLabel: string;
  emptyLabel: string;
  action?: ChatToolActionViewModel;
  panelApp?: ChatPanelAppCardViewModel;
  fileOperation?: {
    blocks: ChatFileOperationBlockViewModel[];
  };
};

export type ChatInlineTokenViewModel = {
  kind: string;
  key: string;
  label: string;
  rawText: string;
};

export type ChatMessagePartViewModel =
  | {
      type: "markdown";
      text: string;
      inlineTokens?: ChatInlineTokenViewModel[];
    }
  | {
      type: "reasoning";
      text: string;
      label: string;
    }
  | {
      type: "tool-card";
      card: ChatToolPartViewModel;
    }
  | {
      type: "file";
      file: {
        label: string;
        mimeType: string;
        dataUrl?: string;
        sizeBytes?: number;
        isImage: boolean;
      };
    }
  | {
      type: "unknown";
      label: string;
      rawType: string;
      text?: string;
    };

export type ChatMessageProcessSummaryViewModel = {
  label: string;
};

export type ChatMessageViewModel = {
  id: string;
  role: ChatMessageRole;
  roleLabel: string;
  timestampLabel: string;
  parts: ChatMessagePartViewModel[];
  status?: string;
  processSummary?: ChatMessageProcessSummaryViewModel;
};

export type ChatAttachmentCategory =
  | "archive"
  | "audio"
  | "code"
  | "data"
  | "document"
  | "generic"
  | "image"
  | "pdf"
  | "sheet"
  | "video";

export type ChatMessageTexts = {
  copyCodeLabel: string;
  copiedCodeLabel: string;
  copyMessageLabel: string;
  copiedMessageLabel: string;
  typingLabel: string;
  attachmentOpenLabel?: string;
  attachmentAttachedLabel?: string;
  attachmentCategoryLabels?: Partial<Record<ChatAttachmentCategory, string>>;
  toolActivitySegmentTemplates?: {
    read: { one: string; other: string };
    edit: { one: string; other: string };
    search: { one: string; other: string };
    bash: { one: string; other: string };
    web: { one: string; other: string };
    agent: { one: string; other: string };
    panel: { one: string; other: string };
    other: { one: string; other: string };
  };
  toolActivityFailedLabel?: string;
  toolActivityCancelledLabel?: string;
  reasoningCharacterCountTemplates?: {
    inProgress: string;
    completed: string;
  };
  toolStatusLabels?: {
    terminal: Record<ChatToolPartViewModel["statusTone"], string>;
    fileRead: Record<ChatToolPartViewModel["statusTone"], string>;
    fileEdit: Record<ChatToolPartViewModel["statusTone"], string>;
    search: Record<ChatToolPartViewModel["statusTone"], string>;
  };
};
