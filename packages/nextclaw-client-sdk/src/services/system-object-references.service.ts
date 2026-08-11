import type {
  SystemObjectReferenceListView,
  SystemObjectResolvedReference,
} from "@nextclaw/shared";
import type { RequestService } from "./request.service.js";

export class SystemObjectReferencesService {
  constructor(private readonly requestService: RequestService) {}

  readonly list = async (params: {
    query?: string;
    limit?: number;
    objectType?: string;
  } = {}): Promise<SystemObjectReferenceListView> =>
    await this.requestService.get<SystemObjectReferenceListView>(
      "/api/system-object-references",
      { query: params },
    );

  readonly resolve = async (uri: string): Promise<SystemObjectResolvedReference> =>
    await this.requestService.post<SystemObjectResolvedReference>(
      "/api/system-object-references/resolve",
      { uri },
    );
}
