import { nextclawClient } from "@/shared/lib/api/managers/client.manager";
import type {
  ProjectCreateRequest,
  ProjectListView,
  ProjectView,
} from "@nextclaw/client-sdk";

export async function fetchProjects(): Promise<ProjectListView> {
  return await nextclawClient.projects.list();
}

export async function createProject(input: ProjectCreateRequest): Promise<ProjectView> {
  return await nextclawClient.projects.create(input);
}
