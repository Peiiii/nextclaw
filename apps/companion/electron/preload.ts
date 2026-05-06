import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("nextclawCompanion", {
  open: () => ipcRenderer.invoke("companion:open"),
  quit: () => ipcRenderer.invoke("companion:quit"),
  getBootstrap: () => ipcRenderer.invoke("companion:get-bootstrap")
});
