export { WechatDesktopObservationService } from "./services/wechat-desktop-observation.service.js";
export type {
  AccessibilityNode,
  WechatDesktopObservationConfig,
  WechatDesktopSnapshot,
  WechatVisibleMessage,
} from "./types/wechat-desktop-extension.types.js";
export {
  findNewWechatMessages,
  normalizeWechatObservationConfig,
  toWechatDesktopSnapshot,
} from "./utils/wechat-desktop-snapshot.utils.js";
