import { useQuery } from "@tanstack/react-query";
import { nextclawClient } from "@/shared/lib/api";

export const projectAgreementQueryKey = (projectId: string) =>
  ["project-agreement", projectId] as const;
export const projectSkillsQueryKey = (projectId: string) =>
  ["project-skills", projectId] as const;

export function useProjectAgreement(projectId: string | null) {
  return useQuery({
    queryKey: projectAgreementQueryKey(projectId ?? ""),
    enabled: Boolean(projectId),
    queryFn: async () => await nextclawClient.projects.getAgreement(projectId!),
  });
}

export function useProjectSkills(projectId: string | null) {
  return useQuery({
    queryKey: projectSkillsQueryKey(projectId ?? ""),
    enabled: Boolean(projectId),
    queryFn: async () =>
      await nextclawClient.projects.listProjectSkills(projectId!),
  });
}
