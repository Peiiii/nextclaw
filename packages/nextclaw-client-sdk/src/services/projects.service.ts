import type {
  ProjectCreateRequest,
  ProjectListView,
  ProjectView,
} from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

export class ProjectsService {
  constructor(private readonly requestService: RequestService) {}

  readonly list = async (): Promise<ProjectListView> =>
    await this.requestService.get<ProjectListView>("/api/projects");

  readonly create = async (input: ProjectCreateRequest): Promise<ProjectView> =>
    await this.requestService.post<ProjectView>("/api/projects", input);
}
