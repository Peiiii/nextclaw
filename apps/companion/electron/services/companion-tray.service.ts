import { Menu, Tray, nativeImage, shell } from "electron";

export class CompanionTrayService {
  private tray: Tray | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly onToggleWindow: () => void,
    private readonly onQuit: () => void
  ) {}

  readonly create = (): void => {
    if (this.tray) {
      return;
    }

    this.tray = new Tray(this.createTrayIcon());
    this.tray.setToolTip("NextClaw Companion");
    this.tray.on("click", this.onToggleWindow);
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Show Companion", click: this.onToggleWindow },
        { label: "Open NextClaw", click: () => void shell.openExternal(this.baseUrl) },
        { type: "separator" },
        { label: "Quit", click: this.onQuit }
      ])
    );
  };

  readonly destroy = (): void => {
    this.tray?.destroy();
    this.tray = null;
  };

  private readonly createTrayIcon = () => {
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
        <rect x="1" y="1" width="18" height="18" rx="6" fill="#16324f"/>
        <circle cx="10" cy="10" r="4" fill="#f5f8fb"/>
      </svg>`
    );
    return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${svg}`);
  };
}
