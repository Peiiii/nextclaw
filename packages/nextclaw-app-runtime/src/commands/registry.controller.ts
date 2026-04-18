import { AppRegistryConfigService } from "../registry/app-registry-config.service.js";

export class RegistryCommand {
  constructor(
    private readonly configService: AppRegistryConfigService = new AppRegistryConfigService(),
  ) {}

  run = async (params: {
    action: "get" | "set" | "reset";
    registryUrl?: string;
    json: boolean;
    write: (text: string) => void;
  }): Promise<void> => {
    const { action, registryUrl, json, write } = params;
    const snapshot =
      action === "set"
        ? await this.configService.setRegistryUrl(this.requireRegistryUrl(registryUrl))
        : action === "reset"
          ? await this.configService.resetRegistryUrl()
          : await this.configService.getSnapshot();
    if (json) {
      write(`${JSON.stringify({ ok: true, registry: snapshot }, null, 2)}\n`);
      return;
    }
    write(`Registry: ${snapshot.currentUrl}\n`);
    write(`Source: ${snapshot.source}\n`);
    write(`Default: ${snapshot.defaultUrl}\n`);
  };

  private requireRegistryUrl = (registryUrl: string | undefined): string => {
    if (!registryUrl) {
      throw new Error("registry set 缺少 URL。");
    }
    return registryUrl;
  };
}
