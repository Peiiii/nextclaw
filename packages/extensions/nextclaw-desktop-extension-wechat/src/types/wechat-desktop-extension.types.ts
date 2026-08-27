export type AccessibilityNode = {
  role?: string;
  subrole?: string;
  title?: string;
  value?: string;
  description?: string;
  identifier?: string;
  focused?: boolean;
  children?: AccessibilityNode[];
};

export type WechatDesktopObservationConfig = {
  conversation?: string;
  ignorePrefixes: string[];
  maxItems: number;
};

export type WechatVisibleMessage = {
  id: string;
  text: string;
  path: number[];
};

export type WechatDesktopSnapshot = {
  applicationId: "wechat";
  conversation?: string;
  messages: WechatVisibleMessage[];
  capturedAt: string;
};
