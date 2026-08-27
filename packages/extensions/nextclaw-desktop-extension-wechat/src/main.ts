import { NextClawExtension } from "@nextclaw/extension-sdk";
import { WechatDesktopObservationService } from "./services/wechat-desktop-observation.service.js";

const extension = new NextClawExtension();
const observation = new WechatDesktopObservationService(extension.host.desktop);
extension.observations.provide(observation.handlers);

process.once("SIGTERM", () => {
  observation.close();
  extension.close();
});

await extension.ready();
