import type {
  ObservedWorkItem,
  ProjectAddExistingRequest,
  ProjectCreateRequest,
  ProjectListView,
  ProjectObservationSnapshot,
  ProjectView,
} from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

type ProjectObservationWireSnapshot = Omit<
  ProjectObservationSnapshot,
  "runs" | "workItems"
> & {
  runs?: ProjectObservationSnapshot["runs"];
  workItems?: Array<Omit<ObservedWorkItem, "name"> & {
    name?: string;
    title?: string;
  }>;
};

function normalizeProjectObservationSnapshot(
  snapshot: ProjectObservationWireSnapshot,
): ProjectObservationSnapshot {
  return {
    ...snapshot,
    runs: Array.isArray(snapshot.runs) ? snapshot.runs : [],
    workItems: (snapshot.workItems ?? []).map(({ title, name, ...item }) => ({
      ...item,
      name: name?.trim() || title?.trim() || item.id,
    })),
  };
}

export class ProjectsService {
  constructor(private readonly requestService: RequestService) {}

  readonly list = async (): Promise<ProjectListView> =>
    await this.requestService.get<ProjectListView>("/api/projects");

  readonly getObservation = async (projectId: string): Promise<ProjectObservationSnapshot> =>
    normalizeProjectObservationSnapshot(
      await this.requestService.get<ProjectObservationWireSnapshot>(
        `/api/projects/${encodeURIComponent(projectId)}/observation`,
      ),
    );

  readonly create = async (input: ProjectCreateRequest): Promise<ProjectView> =>
    await this.requestService.post<ProjectView>("/api/projects", input);

  readonly addExisting = async (input: ProjectAddExistingRequest): Promise<ProjectView> =>
    await this.requestService.post<ProjectView>("/api/projects/existing", input);
}
