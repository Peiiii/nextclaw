import { contextBridge, ipcRenderer } from "electron";
import type { CompanionAvatarView } from "../types/companion.types.js";

contextBridge.exposeInMainWorld("nextclawCompanion", {
  onView: (listener: (view: CompanionAvatarView) => void) => {
    ipcRenderer.on("companion:view", (_event, view: CompanionAvatarView) => {
      listener(view);
    });
  },
  open: () => ipcRenderer.invoke("companion:open"),
  quit: () => ipcRenderer.invoke("companion:quit"),
  ready: () => ipcRenderer.send("companion:ready")
});
