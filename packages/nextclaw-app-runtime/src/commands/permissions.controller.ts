import { AppGrantService } from "../permissions/app-grant.service.js";

export class PermissionsCommand {
  constructor(
    private readonly grantService: AppGrantService = new AppGrantService(),
  ) {}

  run = async (params: {
    appId: string;
    json: boolean;
    write: (text: string) => void;
  }): Promise<void> => {
    const { appId, json, write } = params;
    const result = await this.grantService.summarize(appId);
    if (json) {
      write(`${JSON.stringify({ ok: true, permissions: result }, null, 2)}\n`);
      return;
    }
    write(`Permissions: ${result.name} (${result.appId}) ${result.activeVersion}\n`);
    if (result.documentAccess.length === 0) {
      write("Document access: none\n");
    } else {
      for (const scope of result.documentAccess) {
        write(
          `Document ${scope.id} ${scope.mode} ${scope.granted ? scope.grantedPath : "[missing]"}\n`,
        );
      }
    }
    write(
      `Allowed domains: ${result.allowedDomains.length > 0 ? result.allowedDomains.join(", ") : "none"}\n`,
    );
    write(`Storage: ${result.storage.enabled ? result.storage.namespace ?? "enabled" : "disabled"}\n`);
    write(`Host bridge: ${result.capabilities.hostBridge ? "enabled" : "disabled"}\n`);
  };
}
