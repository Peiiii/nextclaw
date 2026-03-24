export type FeishuMessageResourceType = "audio" | "file" | "image" | "sticker";

export type FeishuMessageResource = {
  type: FeishuMessageResourceType;
  fileKey: string;
  fileName?: string;
  duration?: number;
};

export type FeishuMentionInfo = {
  key: string;
  openId: string;
  name: string;
  isBot: boolean;
};

export type FeishuConvertContext = {
  mentions: Map<string, FeishuMentionInfo>;
  mentionsByOpenId: Map<string, FeishuMentionInfo>;
  stripBotMentions: boolean;
};

export type FeishuConvertedContent = {
  content: string;
  resources: FeishuMessageResource[];
};

export type FeishuMentionLike = {
  key?: unknown;
  name?: unknown;
  id?: unknown;
  open_id?: unknown;
  is_bot?: unknown;
};
