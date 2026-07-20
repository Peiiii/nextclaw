import { nextclawClient } from "@/shared/lib/api/managers/client.manager";
import type {
  ProjectAddExistingRequest,
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

export async function addExistingProject(
  input: ProjectAddExistingRequest,
): Promise<ProjectView> {
  return await nextclawClient.projects.addExisting(input);
}
