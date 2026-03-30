export type ChatTexts = {
  slashLoadingLabel: string;
  slashSectionLabel: string;
  slashEmptyLabel: string;
  slashHintLabel: string;
  slashSkillHintLabel: string;
  sendButtonLabel: string;
  stopButtonLabel: string;
};

export type ChatSlashItem = {
  key: string;
  title: string;
  subtitle: string;
  description: string;
  detailLines: string[];
  value?: string;
};

export type ChatSelectedItem = {
  key: string;
  label: string;
};

export type ChatComposerTokenKind = "skill" | "file";

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

export type ChatSkillPickerProps = {
  title: string;
  searchPlaceholder: string;
  emptyLabel: string;
  loadingLabel: string;
  isLoading?: boolean;
  manageLabel?: string;
  manageHref?: string;
  options: ChatSkillPickerOption[];
  selectedKeys: string[];
  onSelectedKeysChange: (next: string[]) => void;
};

export type ChatInputBarActionsProps = {
  sendError?: string | null;
  isSending: boolean;
  canStopGeneration: boolean;
  sendDisabled: boolean;
  stopDisabled: boolean;
  stopHint: string;
  sendButtonLabel: string;
  stopButtonLabel: string;
  onSend: () => Promise<void> | void;
  onStop: () => Promise<void> | void;
};

export type ChatInputBarToolbarProps = {
  selects: ChatToolbarSelect[];
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

export type ChatSlashMenuProps = {
  isOpen: boolean;
  isLoading: boolean;
  items: ChatSlashItem[];
  activeIndex: number;
  activeItem: ChatSlashItem | null;
  texts: Pick<
    ChatTexts,
    | "slashLoadingLabel"
    | "slashSectionLabel"
    | "slashEmptyLabel"
    | "slashHintLabel"
    | "slashSkillHintLabel"
  >;
  onSelectItem: (item: ChatSlashItem) => void;
  onOpenChange: (open: boolean) => void;
  onSetActiveIndex: (index: number) => void;
};

export type ChatInputBarProps = {
  composer: {
    nodes: ChatComposerNode[];
    placeholder: string;
    disabled: boolean;
    onNodesChange: (nodes: ChatComposerNode[]) => void;
    onFilesAdd?: (files: File[]) => Promise<void> | void;
    onSlashQueryChange?: (query: string | null) => void;
  };
  slashMenu: Pick<ChatSlashMenuProps, "isLoading" | "items" | "texts">;
  hint?: ChatInlineHint | null;
  toolbar: ChatInputBarToolbarProps;
};

export type ChatMessageRole =
  | "user"
  | "assistant"
  | "tool"
  | "system"
  | "message";

export type ChatToolPartViewModel = {
  kind: "call" | "result";
  toolName: string;
  summary?: string;
  output?: string;
  hasResult: boolean;
  statusTone: "running" | "success" | "error" | "cancelled";
  statusLabel: string;
  titleLabel: string;
  outputLabel: string;
  emptyLabel: string;
};

export type ChatMessagePartViewModel =
  | {
      type: "markdown";
      text: string;
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

export type ChatMessageViewModel = {
  id: string;
  role: ChatMessageRole;
  roleLabel: string;
  timestampLabel: string;
  parts: ChatMessagePartViewModel[];
  status?: string;
};

export type ChatMessageTexts = {
  copyCodeLabel: string;
  copiedCodeLabel: string;
  typingLabel: string;
};

export type ChatMessageListProps = {
  messages: ChatMessageViewModel[];
  isSending: boolean;
  hasAssistantDraft: boolean;
  texts: ChatMessageTexts;
  className?: string;
};
