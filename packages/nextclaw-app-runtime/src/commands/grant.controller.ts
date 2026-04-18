import { AppGrantService } from "../permissions/app-grant.service.js";
import type { AppDocumentGrantMap } from "../permissions/app-permissions.types.js";

export class GrantCommand {
  constructor(
    private readonly grantService: AppGrantService = new AppGrantService(),
  ) {}

  run = async (params: {
    appId: string;
    documentGrantMap: AppDocumentGrantMap;
    json: boolean;
    write: (text: string) => void;
  }): Promise<void> => {
    const { appId, documentGrantMap, json, write } = params;
    const results = await Promise.all(
      Object.entries(documentGrantMap).map(([scopeId, directoryPath]) =>
        this.grantService.grantDocumentScope({
          appId,
          scopeId,
          directoryPath,
        }),
      ),
    );
    if (json) {
      write(`${JSON.stringify({ ok: true, grants: results }, null, 2)}\n`);
      return;
    }
    for (const result of results) {
      write(`Granted ${result.scopeId} -> ${result.grantedPath}\n`);
    }
  };
}
