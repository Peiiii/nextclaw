import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addExistingProject, createProject, fetchProjects } from "@/shared/lib/api";
import { t } from "@/shared/lib/i18n";

const PROJECTS_QUERY_KEY = ["projects"] as const;

export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: fetchProjects,
    staleTime: 30_000,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
      toast.success(t("chatProjectCreated"));
    },
    onError: (error: Error) => {
      toast.error(`${t("chatProjectCreateFailed")}: ${error.message}`);
    },
  });
}

export function useAddExistingProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addExistingProject,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
      toast.success(t("chatProjectExistingAdded"));
    },
    onError: (error: Error) => {
      toast.error(`${t("chatProjectExistingFailed")}: ${error.message}`);
    },
  });
}
