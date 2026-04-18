import { AppGrantService } from "../permissions/app-grant.service.js";

export class RevokeCommand {
  constructor(
    private readonly grantService: AppGrantService = new AppGrantService(),
  ) {}

  run = async (params: {
    appId: string;
    documentScopeIds: string[];
    json: boolean;
    write: (text: string) => void;
  }): Promise<void> => {
    const { appId, documentScopeIds, json, write } = params;
    const results = await Promise.all(
      documentScopeIds.map((scopeId) =>
        this.grantService.revokeDocumentScope({
          appId,
          scopeId,
        }),
      ),
    );
    if (json) {
      write(`${JSON.stringify({ ok: true, revocations: results }, null, 2)}\n`);
      return;
    }
    for (const result of results) {
      write(`Revoked ${result.scopeId}: ${result.removed ? "yes" : "no"}\n`);
    }
  };
}
